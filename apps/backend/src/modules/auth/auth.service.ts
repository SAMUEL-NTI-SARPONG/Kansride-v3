import { Injectable, UnauthorizedException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { SMS_PROVIDER } from '../../providers';
import { ISMSProvider } from '../../providers/sms/sms.interface';
import { Database, users, otpRequests } from '@kansride/db';
import { JWTService, OTPService, normalizeGhanaPhone, validateGhanaPhone } from '@kansride/auth';
import { eq, and, gt, desc, count } from 'drizzle-orm';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtService: JWTService;
  private readonly otpService: OTPService;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(SMS_PROVIDER) private readonly smsProvider: ISMSProvider,
  ) {
    this.jwtService = new JWTService({
      accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
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

    // Find or create user
    let user = await this.db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, normalized))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user) {
      const inserted = await this.db
        .insert(users)
        .values({
          phoneNumber: normalized,
          role: 'passenger',
          isVerified: true,
        })
        .returning();
      user = inserted[0]!;
      this.logger.log(`New user created: ${user.id} (${normalized})`);
    } else if (!user.isVerified) {
      await this.db.update(users).set({ isVerified: true }).where(eq(users.id, user.id));
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
