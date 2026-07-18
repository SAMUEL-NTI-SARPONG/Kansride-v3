import jwt from 'jsonwebtoken';

export interface JWTConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiry: string;
  refreshExpiry: string;
}

export interface TokenPayload {
  userId: string;
  phoneNumber: string;
  role: string;
}

export class JWTService {
  constructor(private config: JWTConfig) {}

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.config.accessSecret, {
      expiresIn: this.config.accessExpiry as unknown as jwt.SignOptions['expiresIn'],
    });
  }

  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.config.refreshSecret, {
      expiresIn: this.config.refreshExpiry as unknown as jwt.SignOptions['expiresIn'],
    });
  }

  generateTokenPair(payload: TokenPayload): { accessToken: string; refreshToken: string; expiresIn: number } {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
    const expiresIn = (decoded?.exp ?? 0) - (decoded?.iat ?? 0);
    return { accessToken, refreshToken, expiresIn };
  }

  verifyAccessToken(token: string): TokenPayload & { iat: number; exp: number } {
    return jwt.verify(token, this.config.accessSecret) as TokenPayload & { iat: number; exp: number };
  }

  verifyRefreshToken(token: string): TokenPayload & { iat: number; exp: number } {
    return jwt.verify(token, this.config.refreshSecret) as TokenPayload & { iat: number; exp: number };
  }
}
