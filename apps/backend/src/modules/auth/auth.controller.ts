import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { TokenPayload } from '@kansride/auth';
import { Throttle } from '@nestjs/throttler';
import { PhoneDTO, VerifyOTPDTO, LoginPINDTO, PassengerRegistrationDTO, RegisterPassengerDTO, RefreshTokenDTO } from './auth.dto';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly sessions: SessionService) {}

  @Post('register-passenger')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  registerPassenger(@Body() body: RegisterPassengerDTO) {
    return this.authService.registerPassenger(body);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request & { user: TokenPayload }) {
    await this.sessions.end(req.user);
    return { message: 'Signed out' };
  }

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOTP(@Body() body: PhoneDTO) {
    return this.authService.requestOTP(body.phoneNumber);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOTP(@Body() body: VerifyOTPDTO) {
    return this.authService.verifyOTP(body.phoneNumber, body.code);
  }

  @Post('login-pin')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @HttpCode(HttpStatus.OK)
  async loginWithPIN(@Body() body: LoginPINDTO) {
    return this.authService.loginWithPIN(body.phoneNumber, body.pin);
  }

  @Post('complete-passenger-registration')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async completePassengerRegistration(
    @Req() req: Request & { user: TokenPayload },
    @Body() body: PassengerRegistrationDTO,
  ) {
    return this.authService.completePassengerRegistration(req.user.userId, body);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() body: RefreshTokenDTO) {
    return this.authService.refreshToken(body.refreshToken);
  }
}
