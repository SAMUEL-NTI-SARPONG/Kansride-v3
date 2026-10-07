import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException, HttpException, Inject, Logger } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { SMS_PROVIDER } from '../../providers';
import { ISMSProvider } from '../../providers/sms/sms.interface';
import { Database, users, otpRequests, passengers } from '@kansride/db';
import { JWTService, OTPService, normalizeGhanaPhone, validateGhanaPhone, hashPIN, verifyPIN } from '@kansride/auth';
import { eq, and, gt, desc, count, isNull } from 'drizzle-orm';
import { getEnv } from '@kansride/config';
import { createHash } from 'node:crypto';
import { REDIS_SERVICE, type IRedisService } from '../../redis';
import { SessionService } from './session.service';

const PIN_PATTERN = /^\d{4}$/;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtService: JWTService;
  private readonly otpService: OTPService;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(SMS_PROVIDER) private readonly smsProvider: ISMSProvider,
    @Inject(REDIS_SERVICE) private readonly redis: IRedisService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {
    const env = getEnv();
    this.jwtService = new JWTService({
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpiry: '15m',
      refreshExpiry: '7d',
    });
    this.otpService = new OTPService();
  }

  async requestOTP(phoneNumber: string) {
    const normalized = normalizeGhanaPhone(phoneNumber);
    if (!validateGhanaPhone(normalized)) {
      throw new BadRequestException('Invalid Ghana phone number');
    }

    // Mobile registration/login is PIN-only. Retain OTP solely for existing,
    // controlled staff accounts; it must not create or reclaim mobile accounts.
    await this.staffAccount(normalized);

    // Rate limit: max 3 OTP requests per 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequests = await this.db
      .select({ total: count() })
      .from(otpRequests)
      .where(and(
        eq(otpRequests.phoneNumber, normalized),
        gt(otpRequests.createdAt, fifteenMinAgo)
      ));

    const requestCount = recentRequests[0]?.total ?? 0;
    if (requestCount >= 3) {
      throw new BadRequestException('Too many OTP requests. Please try again in 15 minutes.');
    }

    // Generate and store OTP
    const code = this.otpService.generateOTP();
    const codeHash = this.otpService.hashOTP(code);
    const expiresAt = this.otpService.createExpiryDate(10); // 10 minutes

    const insertedOtp = await this.db.insert(otpRequests).values({
      phoneNumber: normalized,
      codeHash,
      attempts: 0,
      maxAttempts: 3,
      expiresAt,
    }).returning({ id: otpRequests.id });
    const otpRowId = insertedOtp[0]?.id;
    if (!otpRowId) {
      throw new ServiceUnavailableException('Could not persist OTP request. Please try again.');
    }

    // Send OTP via SMS provider. A delivery failure must NOT be reported to
    // the client as success: previously the code was persisted (consuming the
    // per-15-minute rate limit) and the API returned "OTP sent successfully"
    // even when the SMS gateway never accepted the message, leaving the user
    // waiting for a code that would never arrive. Surface a 503 and remove the
    // just-inserted code row so this failed attempt does not consume the
    // rate-limit window — the user can immediately request a new code.
    const result = await this.smsProvider.sendOTP(normalized, code).catch(() => ({ success: false }));
    this.logger.log(`OTP send accepted: ${result.success}`);

    if (!result.success) {
      await this.db
        .delete(otpRequests)
        .where(eq(otpRequests.id, otpRowId));
      throw new ServiceUnavailableException('OTP delivery failed. Please try again in a moment.');
    }

    return { message: 'OTP sent successfully', expiresIn: 600 };
  }

  async verifyOTP(phoneNumber: string, code: string) {
    const normalized = normalizeGhanaPhone(phoneNumber);
    await this.staffAccount(normalized);

    // Find the latest unexpired, unverified OTP for this phone
    const otpRecords = await this.db
      .select()
      .from(otpRequests)
      .where(and(
        eq(otpRequests.phoneNumber, normalized),
        gt(otpRequests.expiresAt, new Date()),
      ))
      .orderBy(desc(otpRequests.createdAt))
      .limit(1);

    const otpRecord = otpRecords[0];
    if (!otpRecord) {
      throw new UnauthorizedException('No valid OTP found. Please request a new one.');
    }

    if (otpRecord.verifiedAt) {
      throw new UnauthorizedException('OTP already used. Please request a new one.');
    }

    // Check attempts
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      throw new UnauthorizedException('Maximum attempts exceeded. Please request a new OTP.');
    }

    // Increment attempts with a conditional update (WHERE attempts =
    // snapshot) so two concurrent verify requests cannot both pass the
    // < maxAttempts check and both increment — the loser observes zero rows
    // updated and is rejected. This mirrors the concurrent-update guard used
    // for ride transitions and prevents exceeding maxAttempts via racing.
    const incremented = await this.db
      .update(otpRequests)
      .set({ attempts: otpRecord.attempts + 1 })
      .where(and(eq(otpRequests.id, otpRecord.id), eq(otpRequests.attempts, otpRecord.attempts), isNull(otpRequests.verifiedAt)))
      .returning({ id: otpRequests.id });
    if (!incremented[0]) {
      throw new UnauthorizedException('OTP verification is being processed, please retry.');
    }

    // Verify the code
    const isValid = this.otpService.verifyOTP(code, otpRecord.codeHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid OTP code.');
    }

    // Mark OTP as verified
    const claimed = await this.db
      .update(otpRequests)
      .set({ verifiedAt: new Date() })
      .where(and(
        eq(otpRequests.id, otpRecord.id),
        eq(otpRequests.attempts, otpRecord.attempts + 1),
        isNull(otpRequests.verifiedAt),
        gt(otpRequests.expiresAt, new Date()),
      )).returning({ id: otpRequests.id });
    if (!claimed[0]) throw new UnauthorizedException('OTP already used or expired. Please request a new one.');

    // Re-read after claiming the code. OTP never creates a mobile account or
    // changes its PIN, role or manual verification state.
    const user = await this.staffAccount(normalized);

    // Generate tokens
    const sessionId = await this.sessions.start(user!);
    const tokens = this.jwtService.generateTokenPair({
      userId: user!.id,
      phoneNumber: normalized,
      role: user!.role,
      sessionId,
    });

    return {
      ...tokens,
      registrationComplete: Boolean(user!.pinHash && user!.firstName),
      user: {
        id: user!.id,
        phoneNumber: user!.phoneNumber,
        role: user!.role,
        firstName: user!.firstName,
        lastName: user!.lastName,
      },
    };
  }

  async completePassengerRegistration(
    userId: string,
    data: { fullName: string; pin: string; communityId?: string },
  ) {
    const fullName = data.fullName?.trim();
    if (!fullName) throw new BadRequestException('Name is required');
    if (!PIN_PATTERN.test(data.pin || '')) {
      throw new BadRequestException('PIN must contain exactly 4 digits');
    }
    const [firstName, ...rest] = fullName.split(/\s+/);
    const [updated] = await this.db.update(users).set({
      firstName,
      lastName: rest.join(' ') || null,
      pinHash: hashPIN(data.pin),
      communityId: data.communityId?.trim() || 'kansaworodo',
      updatedAt: new Date(),
    }).where(and(eq(users.id, userId), eq(users.role, 'passenger'), isNull(users.pinHash))).returning();
    if (!updated) throw new BadRequestException('Passenger account could not be completed');
    return { message: 'Passenger account created', user: this.publicUser(updated) };
  }

  async loginWithPIN(phoneNumber: string, pin: string) {
    const normalized = normalizeGhanaPhone(phoneNumber);
    if (!validateGhanaPhone(normalized) || !PIN_PATTERN.test(pin || '')) {
      throw new UnauthorizedException('Invalid phone number or PIN');
    }
    // Four-digit PINs require an account-scoped limit, not just per-IP limits.
    // Hash the normalized phone so Redis keys do not contain contact details.
    const limitKey = `auth:pin:${createHash('sha256').update(normalized).digest('hex')}`;
    const allowed = await this.redis.consumeRateLimit(limitKey, 5, 15 * 60).catch(() => {
      throw new ServiceUnavailableException('Login temporarily unavailable. Please try again.');
    });
    if (!allowed) throw new HttpException('Too many PIN attempts. Try again in 15 minutes.', 429);
    const [user] = await this.db.select().from(users).where(eq(users.phoneNumber, normalized)).limit(1);
    if (!user?.pinHash || user.status !== 'active' || !verifyPIN(pin, user.pinHash)) {
      throw new UnauthorizedException('Invalid phone number or PIN');
    }
    await this.redis.del(limitKey).catch(() => undefined);
    if (user.role === 'driver_applicant' || (user.role === 'driver' && !user.isVerified)) {
      throw new ForbiddenException('Your driver application is pending admin approval. Please contact KansRide support.');
    }
    if (user.role !== 'passenger' && !user.isVerified) throw new UnauthorizedException('Account has not been approved');
    const sessionId = await this.sessions.start(user);
    const tokens = this.jwtService.generateTokenPair({ userId: user.id, phoneNumber: user.phoneNumber, role: user.role, sessionId });
    return { ...tokens, user: this.publicUser(user) };
  }

  private publicUser(user: typeof users.$inferSelect) {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      communityId: user.communityId,
    };
  }

  async registerPassenger(data: { phoneNumber: string; fullName: string; pin: string; communityId?: string }) {
    const normalized = normalizeGhanaPhone(data.phoneNumber);
    const name = data.fullName?.trim();
    if (!validateGhanaPhone(normalized) || !name || name.length > 160 || !PIN_PATTERN.test(data.pin || '')) {
      throw new BadRequestException('Enter your name, a valid Ghana number and a 4-digit PIN');
    }
    const [firstName, ...lastName] = name.split(/\s+/);
    const user = await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({
        phoneNumber: normalized, firstName, lastName: lastName.join(' ') || null,
        pinHash: hashPIN(data.pin), role: 'passenger', isVerified: false,
        communityId: data.communityId?.trim() || null,
      }).onConflictDoNothing({ target: users.phoneNumber }).returning();
      if (!created) throw new ConflictException('An account already uses this number. Sign in or contact support.');
      await tx.insert(passengers).values({ userId: created.id });
      return created;
    });
    const sessionId = await this.sessions.start(user);
    return {
      ...this.jwtService.generateTokenPair({ userId: user.id, phoneNumber: user.phoneNumber, role: user.role, sessionId }),
      user: this.publicUser(user),
    };
  }

  private async staffAccount(phoneNumber: string) {
    const [user] = await this.db.select().from(users).where(eq(users.phoneNumber, phoneNumber)).limit(1);
    if (!user || ['passenger', 'driver', 'driver_applicant'].includes(user.role) || user.status !== 'active' || !user.isVerified) {
      throw new UnauthorizedException('Use your phone number and PIN to sign in. Contact support if you need help.');
    }
    return user;
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verifyRefreshToken(refreshToken);

      // Re-confirm the user still exists and is active before re-issuing.
      // Previously the refresh path trusted the stale JWT payload for up to
      // 7 days, so a suspended/banned user (users.status !== 'active') or a
      // user whose role was changed kept obtaining usable access tokens. The
      // JWT carries users.id, so we re-load the row by that id and use the
      // current role/status for the new token; reject if the user is gone or
      // no longer active.
      let userRecord: typeof users.$inferSelect | undefined;
      try {
        const rows = await this.db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
        userRecord = rows[0];
      } catch {
        throw new ServiceUnavailableException('Sign in temporarily unavailable. Please retry.');
      }

      if (!userRecord || userRecord.status !== 'active' || !payload.sessionId || userRecord.activeSessionId !== payload.sessionId || userRecord.role !== payload.role || (userRecord.role !== 'passenger' && !userRecord.isVerified)) {
        throw new UnauthorizedException('Session is no longer valid');
      }

      const tokens = this.jwtService.generateTokenPair({
        userId: userRecord.id,
        phoneNumber: userRecord.phoneNumber,
        role: userRecord.role,
        sessionId: payload.sessionId,
      });
      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
