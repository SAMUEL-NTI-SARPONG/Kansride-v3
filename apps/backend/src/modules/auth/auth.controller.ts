import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { TokenPayload } from '@kansride/auth';
import { Throttle } from '@nestjs/throttler';
import { PhoneDTO, VerifyOTPDTO, LoginPINDTO, PassengerRegistrationDTO, RefreshTokenDTO } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
