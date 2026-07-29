import { Injectable, UnauthorizedException, BadRequestException, ServiceUnavailableException, Inject, Logger } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { SMS_PROVIDER } from '../../providers';
import { ISMSProvider } from '../../providers/sms/sms.interface';
import { Database, users, otpRequests, passengers } from '@kansride/db';
import { JWTService, OTPService, normalizeGhanaPhone, validateGhanaPhone } from '@kansride/auth';
import { eq, and, gt, desc, count } from 'drizzle-orm';
import { getEnv } from '@kansride/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtService: JWTService;
  private readonly otpService: OTPService;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(SMS_PROVIDER) private readonly smsProvider: ISMSProvider,
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
    const result = await this.smsProvider.sendOTP(normalized, code);
    this.logger.log(`OTP requested for ${normalized}, sent: ${result.success}`);

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
      .where(and(eq(otpRequests.id, otpRecord.id), eq(otpRequests.attempts, otpRecord.attempts)))
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
    await this.db
      .update(otpRequests)
      .set({ verifiedAt: new Date() })
      .where(eq(otpRequests.id, otpRecord.id));

    // Find or create user, and ensure a passenger profile exists for
    // passenger-role users. New-user creation and its passenger-profile
    // creation are wrapped in a single transaction so they succeed or
    // fail atomically. For an existing passenger user, the passenger
    // profile is ensured via an idempotent lookup-or-insert: the unique
    // constraint on passengers.userId serializes concurrent attempts.
    let user = await this.db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, normalized))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user) {
      user = await this.db.transaction(async (tx) => {
        const inserted = await tx
          .insert(users)
          .values({
            phoneNumber: normalized,
            role: 'passenger',
            isVerified: true,
          })
          .returning();
        const newUser = inserted[0]!;
        this.logger.log(`New user created: ${newUser.id} (${normalized})`);

        if (newUser.role === 'passenger') {
          await tx
            .insert(passengers)
            .values({ userId: newUser.id })
            .onConflictDoNothing({ target: passengers.userId });
          this.logger.log(`Passenger profile ensured for user ${newUser.id}`);
        }
        return newUser;
      });
    } else {
      // Existing-user verification: the isVerified flag update and the
      // passenger-profile backfill must succeed or fail atomically. The
      // new-user path above already wraps both writes in a transaction;
      // this branch previously issued them as independent statements, so a
      // failure of the passengers insert after isVerified=true would leave
      // the user verified but unable to create rides. Wrap both in one
      // transaction to match the new-user path.
      await this.db.transaction(async (tx) => {
        if (!user!.isVerified) {
          await tx.update(users).set({ isVerified: true }).where(eq(users.id, user!.id));
        }

        // Ensure a passenger profile exists for an existing passenger-role
        // user. This is idempotent: ON CONFLICT DO NOTHING on the unique
        // passengers.userId constraint means repeated verification never
        // creates a duplicate row, and a concurrent insert by another
        // request is serialized by the unique constraint at the DB layer.
        if (user!.role === 'passenger') {
          await tx
            .insert(passengers)
            .values({ userId: user!.id })
            .onConflictDoNothing({ target: passengers.userId });
        }
      });
    }

    // Generate tokens
    const tokens = this.jwtService.generateTokenPair({
      userId: user!.id,
      phoneNumber: normalized,
      role: user!.role,
    });

    return {
      ...tokens,
      user: {
        id: user!.id,
        phoneNumber: user!.phoneNumber,
        role: user!.role,
        firstName: user!.firstName,
        lastName: user!.lastName,
      },
    };
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
      const userRecord = await this.db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!userRecord || userRecord.status !== 'active') {
        throw new UnauthorizedException('Session is no longer valid');
      }

      const tokens = this.jwtService.generateTokenPair({
        userId: userRecord.id,
        phoneNumber: userRecord.phoneNumber,
        role: userRecord.role,
      });
      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
