import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JWTService, OTPService, normalizeGhanaPhone, validateGhanaPhone } from '@kansride/auth';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtService: JWTService;
  private readonly otpService: OTPService;

  constructor() {
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
      throw new UnauthorizedException('Invalid Ghana phone number');
    }

    const otp = this.otpService.generateOTP();
    const hash = this.otpService.hashOTP(otp);
    this.logger.log(`[DEV] OTP for ${normalized}: ${otp}`);

    // TODO: Store OTP hash in DB, send SMS via provider
    return { message: 'OTP sent successfully', expiresIn: 300 };
  }

  async verifyOTP(phoneNumber: string, code: string) {
    const normalized = normalizeGhanaPhone(phoneNumber);

    // TODO: Retrieve OTP from DB and verify
    // For now, accept any 6-digit code in dev
    if (code.length !== 6) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const tokens = this.jwtService.generateTokenPair({
      userId: 'placeholder-user-id',
      phoneNumber: normalized,
      role: 'passenger',
    });

    return { ...tokens, user: { phoneNumber: normalized, role: 'passenger' } };
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
