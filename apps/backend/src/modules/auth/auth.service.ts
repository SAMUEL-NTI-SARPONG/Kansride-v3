import { Injectable, UnauthorizedException, BadRequestException, Inject, Logger } from '@nestjs/common';
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

    await this.db.insert(otpRequests).values({
      phoneNumber: normalized,
      codeHash,
      attempts: 0,
      maxAttempts: 3,
      expiresAt,
    });

    // Send OTP via SMS provider
    const result = await this.smsProvider.sendOTP(normalized, code);
    this.logger.log(`OTP requested for ${normalized}, sent: ${result.success}`);

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

    // Increment attempts
    await this.db
      .update(otpRequests)
      .set({ attempts: otpRecord.attempts + 1 })
      .where(eq(otpRequests.id, otpRecord.id));

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
      if (!user.isVerified) {
        await this.db.update(users).set({ isVerified: true }).where(eq(users.id, user.id));
      }

      // Ensure a passenger profile exists for an existing passenger-role
      // user. This is idempotent: ON CONFLICT DO NOTHING on the unique
      // passengers.userId constraint means repeated verification never
      // creates a duplicate row, and a concurrent insert by another
      // request is serialized by the unique constraint at the DB layer.
      if (user.role === 'passenger') {
        await this.db
          .insert(passengers)
          .values({ userId: user.id })
          .onConflictDoNothing({ target: passengers.userId });
      }
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
      const tokens = this.jwtService.generateTokenPair({
        userId: payload.userId,
        phoneNumber: payload.phoneNumber,
        role: payload.role,
      });
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
