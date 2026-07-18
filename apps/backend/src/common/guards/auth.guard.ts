import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JWTService } from '@kansride/auth';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwtService: JWTService;

  constructor() {
    this.jwtService = new JWTService({
      accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      accessExpiry: '15m',
      refreshExpiry: '7d',
    });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      const token = authHeader.slice(7);
      const payload = this.jwtService.verifyAccessToken(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
