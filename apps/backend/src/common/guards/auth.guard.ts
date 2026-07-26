import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWTService } from '@kansride/auth';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { getEnv } from '@kansride/config';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwtService: JWTService;

  constructor(private readonly reflector: Reflector) {
    const env = getEnv();
    this.jwtService = new JWTService({
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpiry: '15m',
      refreshExpiry: '7d',
    });
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

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
