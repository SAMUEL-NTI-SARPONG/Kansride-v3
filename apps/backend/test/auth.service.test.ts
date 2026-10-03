import { describe, it, expect, vi, beforeAll } from 'vitest';
import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import type { Database } from '@kansride/db';
import { AuthService } from '../src/modules/auth/auth.service';
import type { ISMSProvider } from '../src/providers/sms/sms.interface';
import { makeDbStub } from './helpers/drizzle-mock';
import { OTPService, hashPIN } from '@kansride/auth';
import { MemoryRedisService } from '../src/redis/memory-redis.service';

// AuthService's constructor calls getEnv(), which validates the environment.
// No repo-root .env exists in the test environment, so set the required
// DATABASE_URL (postgres scheme — the new env gate rejects anything else) and
// deterministic JWT secrets before the first construction. getEnv caches, so
// these are read once per test file (vitest isolates modules per file).
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.NODE_ENV = 'test';
  process.env.SMS_PROVIDER = 'mock';
});

const USER_ID = '00000000-0000-4000-8000-000000000001';

function makeSmsProvider(success: boolean, messageId?: string): ISMSProvider {
  return {
    sendOTP: vi.fn().mockResolvedValue(
      success ? { success: true, messageId: messageId ?? 'msg-1' } : { success: false },
    ),
  };
}

function buildAuthService(db = makeDbStub(), sms: ISMSProvider = makeSmsProvider(true)) {
  const redis = new MemoryRedisService();
  const service = new AuthService(
    db as unknown as Database,
    sms,
    redis,
  );
  return { service, db, sms, redis };
}

describe('account-scoped PIN protection', () => {
  it('limits failed attempts for the same phone across different number formats', async () => {
    const { service, db } = buildAuthService();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      db.enqueue([]);
      await expect(service.loginWithPIN(attempt % 2 ? '0501234567' : '+233501234567', '1234')).rejects.toThrow(UnauthorizedException);
    }
    await expect(service.loginWithPIN('233501234567', '1234')).rejects.toThrow('Too many PIN attempts');
    db.assertDrained();
  });
  it('clears failures after valid PIN authentication', async () => {
    const { service, db, redis } = buildAuthService();
    const remove = vi.spyOn(redis, 'del');
    db.enqueue([{
      id: USER_ID, phoneNumber: '+233501234567', role: 'passenger',
      status: 'active', isVerified: true, pinHash: hashPIN('0123'),
    }]);
    expect(await service.loginWithPIN('+233501234567', '0123')).toHaveProperty('accessToken');
    expect(remove).toHaveBeenCalledWith(expect.stringMatching(/^auth:pin:[a-f0-9]{64}$/));
    db.assertDrained();
  });
  it('fails closed if the shared account limiter is unavailable', async () => {
    const { service, db, redis } = buildAuthService();
    vi.spyOn(redis, 'consumeRateLimit').mockRejectedValue(new Error('offline'));
    await expect(service.loginWithPIN('+233501234567', '1234')).rejects.toThrow(ServiceUnavailableException);
    db.assertDrained();
  });
});

describe('AuthService.requestOTP — honest SMS delivery reporting (B1)', () => {
  it('throws ServiceUnavailableException when the SMS provider rejects the message', async () => {
    const { service, db, sms } = buildAuthService(makeDbStub(), makeSmsProvider(false));
    db.enqueue([{ total: 0 }]); // rate-limit count
    db.enqueue([{ id: 'otp-row-1' }]); // insert returning { id }
    db.enqueue([undefined]); // cleanup delete of the just-inserted row

    await expect(
      service.requestOTP('+233501234567'),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(sms.sendOTP).toHaveBeenCalledTimes(1);
    db.assertDrained();
  });

  it('resolves with a success message when the SMS provider accepts the message', async () => {
    const { service, db } = buildAuthService();
    db.enqueue([{ total: 0 }]); // rate-limit count
    db.enqueue([{ id: 'otp-row-1' }]); // insert returning { id }

    const result = await service.requestOTP('+233501234567');
    expect(result).toEqual({ message: 'OTP sent successfully', expiresIn: 600 });
    // No cleanup delete is issued on the success path.
    expect(db.pending()).toBe(0);
  });
});

describe('AuthService.verifyOTP — race-safe attempt increment (B3)', () => {
  function enqueueOTP(db: ReturnType<typeof makeDbStub>) {
    db.enqueue([{
      id: 'otp-row-1', phoneNumber: '+233501234567',
      codeHash: new OTPService().hashOTP('123456'), attempts: 0, maxAttempts: 3,
      verifiedAt: null, expiresAt: new Date(Date.now() + 60_000),
    }]);
    db.enqueue([{ id: 'otp-row-1' }]);
  }

  it('does not issue a session when another request already consumed the OTP', async () => {
    const { service, db } = buildAuthService();
    enqueueOTP(db);
    db.enqueue([]); // conditional claim loses
    await expect(service.verifyOTP('+233501234567', '123456')).rejects.toThrow('already used or expired');
    db.assertDrained();
  });

  it('does not reactivate a suspended account through OTP login', async () => {
    const { service, db } = buildAuthService();
    enqueueOTP(db);
    db.enqueue([{ id: 'otp-row-1' }]);
    db.enqueue([{ id: USER_ID, phoneNumber: '+233501234567', role: 'passenger', status: 'suspended' }]);
    await expect(service.verifyOTP('+233501234567', '123456')).rejects.toThrow('Account is not active');
    db.assertDrained();
  });

  it('rejects with a retry message when a concurrent verify already incremented attempts (0 rows updated)', async () => {
    const { service, db } = buildAuthService();
    db.enqueue([{
      id: 'otp-row-1',
      phoneNumber: '+233501234567',
      codeHash: 'hash',
      attempts: 2,
      maxAttempts: 3,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }]); // latest unexpired OTP lookup
    db.enqueue([]); // conditional increment returning 0 rows — concurrent loser

    const promise = service.verifyOTP('+233501234567', '123456');
    await expect(promise).rejects.toThrow(UnauthorizedException);
    await expect(promise).rejects.toThrow(/being processed/);
    db.assertDrained();
  });
});

describe('OTP gateway exceptions', () => {
  it('cleans up the failed code and returns a controlled error if the gateway throws', async () => {
    const sms = { sendOTP: vi.fn().mockRejectedValue(new Error('network failure')) };
    const { service, db } = buildAuthService(makeDbStub(), sms);
    db.enqueue([{ total: 0 }]); db.enqueue([{ id: 'otp-row-1' }]); db.enqueue([]);
    await expect(service.requestOTP('+233501234567')).rejects.toThrow(ServiceUnavailableException);
    db.assertDrained();
  });
});

describe('AuthService.refreshToken — re-validate the user before re-issuing (B2)', () => {
  // Mint refresh tokens with the AuthService's own JWTService instance so the
  // signing secret can never diverge from the one verifyRefreshToken uses.
  function mintRefreshToken(service: AuthService, payload: { userId: string; phoneNumber: string; role: string }) {
    return (service as unknown as { jwtService: { generateRefreshToken: (p: typeof payload) => string } })
      .jwtService.generateRefreshToken(payload);
  }

  it('rejects when the user no longer exists', async () => {
    const { service, db } = buildAuthService();
    db.enqueue([]); // users lookup returns no row
    const token = mintRefreshToken(service, { userId: USER_ID, phoneNumber: '+233501234567', role: 'passenger' });
    const promise = service.refreshToken(token);
    await expect(promise).rejects.toThrow(UnauthorizedException);
    await expect(promise).rejects.toThrow(/no longer valid/);
    db.assertDrained();
  });

  it('rejects when the user is suspended (status !== active)', async () => {
    const { service, db } = buildAuthService();
    db.enqueue([{
      id: USER_ID,
      phoneNumber: '+233501234567',
      role: 'passenger',
      status: 'suspended',
      isVerified: true,
    }]);
    const token = mintRefreshToken(service, { userId: USER_ID, phoneNumber: '+233501234567', role: 'passenger' });
    await expect(service.refreshToken(token)).rejects.toThrow(/no longer valid/);
    db.assertDrained();
  });

  it('re-issues with the current role when the user is active', async () => {
    const { service, db } = buildAuthService();
    db.enqueue([{
      id: USER_ID,
      phoneNumber: '+233501234567',
      // The persisted role has changed since the refresh token was minted;
      // the refresh path must use the *current* role, not the stale payload.
      role: 'driver',
      status: 'active',
      isVerified: true,
    }]);
    const token = mintRefreshToken(service, { userId: USER_ID, phoneNumber: '+233501234567', role: 'passenger' });
    const refreshed = await service.refreshToken(token);
    expect(refreshed).toHaveProperty('accessToken');
    expect(refreshed).toHaveProperty('refreshToken');
    // The decoded access token carries the current role ('driver'), proving
    // we did not replay the stale 'passenger' role from the refresh payload.
    const decoded = (service as unknown as { jwtService: { verifyAccessToken: (t: string) => { role: string } } })
      .jwtService.verifyAccessToken(refreshed.accessToken);
    expect(decoded.role).toBe('driver');
    db.assertDrained();
  });
});
