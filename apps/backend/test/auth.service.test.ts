import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Database } from '@kansride/db';
import { AuthService } from '../src/modules/auth/auth.service';
import { SessionService } from '../src/modules/auth/session.service';
import { MemoryRedisService } from '../src/redis/memory-redis.service';
import { makeDbStub } from './helpers/drizzle-mock';
import { hashPIN, OTPService } from '@kansride/auth';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.NODE_ENV = 'test';
  process.env.SMS_PROVIDER = 'mock';
});
const ID = '00000000-0000-4000-8000-000000000001';
const SID = '00000000-0000-4000-8000-000000000002';
const account = (extra = {}) => ({ id: ID, phoneNumber: '+233501234567', role: 'passenger', status: 'active', isVerified: false, firstName: 'Ama', pinHash: hashPIN('0123'), activeSessionId: SID, ...extra });
const staff = () => account({ role: 'super_admin', isVerified: true });
function build() {
  const db = makeDbStub();
  const sms = { sendOTP: vi.fn().mockResolvedValue({ success: true }) };
  const redis = new MemoryRedisService();
  const sessions = { start: vi.fn().mockResolvedValue(SID) };
  const service = new AuthService(db as unknown as Database, sms, redis, sessions as unknown as SessionService);
  return { db, sms, redis, sessions, service };
}
describe('PIN-only registration and login', () => {
  it('creates a passenger/profile without SMS and starts a session', async () => {
    const { db, service, sms, sessions } = build();
    db.enqueue([account()]); db.enqueue([]);
    const result = await service.registerPassenger({ phoneNumber: '0501234567', fullName: 'Ama Owusu', pin: '0123' });
    expect(result.user.role).toBe('passenger');
    expect(result.accessToken).toBeTruthy();
    expect(sessions.start).toHaveBeenCalledWith(expect.objectContaining({ id: ID }));
    expect(sms.sendOTP).not.toHaveBeenCalled();
    db.assertDrained();
  });
  it('does not overwrite an existing account or PIN', async () => {
    const { db, service, sessions } = build();
    db.enqueue([]);
    await expect(service.registerPassenger({ phoneNumber: '0501234567', fullName: 'Other', pin: '9999' })).rejects.toThrow(ConflictException);
    expect(sessions.start).not.toHaveBeenCalled(); db.assertDrained();
  });
  it('rejects invalid registration before writes', async () => {
    const { db, service } = build();
    await expect(service.registerPassenger({ phoneNumber: 'bad', fullName: ' ', pin: 'abc' })).rejects.toThrow();
    db.assertDrained();
  });
  it('allows passengers to log in without an OTP/manual verified flag', async () => {
    const { db, service, sessions } = build(); db.enqueue([account()]);
    expect(await service.loginWithPIN('0501234567', '0123')).toHaveProperty('accessToken');
    expect(sessions.start).toHaveBeenCalledOnce(); db.assertDrained();
  });
  it('blocks pending drivers even with a correct PIN', async () => {
    const { db, service, sessions } = build(); db.enqueue([account({ role: 'driver_applicant' })]);
    await expect(service.loginWithPIN('0501234567', '0123')).rejects.toThrow(ForbiddenException);
    expect(sessions.start).not.toHaveBeenCalled(); db.assertDrained();
  });
  it('allows a manually approved driver to log in', async () => {
    const { db, service } = build(); db.enqueue([account({ role: 'driver', isVerified: true })]);
    expect(await service.loginWithPIN('0501234567', '0123')).toHaveProperty('accessToken'); db.assertDrained();
  });
  it('limits wrong PINs across phone number formats', async () => {
    const { db, service } = build();
    for (let i = 0; i < 5; i++) {
      db.enqueue([]);
      await expect(service.loginWithPIN(i % 2 ? '0501234567' : '+233501234567', '1234')).rejects.toThrow(UnauthorizedException);
    }
    await expect(service.loginWithPIN('233501234567', '1234')).rejects.toThrow('Too many PIN attempts');
    db.assertDrained();
  });
  it('clears attempts after successful login', async () => {
    const { db, service, redis } = build(); db.enqueue([account()]);
    const remove = vi.spyOn(redis, 'del');
    await service.loginWithPIN('0501234567', '0123');
    expect(remove).toHaveBeenCalledWith(expect.stringMatching(/^auth:pin:[a-f0-9]{64}$/));
  });
  it('fails closed on limiter outage', async () => {
    const { service, redis } = build();
    vi.spyOn(redis, 'consumeRateLimit').mockRejectedValue(new Error('offline'));
    await expect(service.loginWithPIN('0501234567', '0123')).rejects.toThrow(ServiceUnavailableException);
  });
  it('cannot reactivate a suspended account', async () => {
    const { db, service } = build(); db.enqueue([account({ status: 'suspended' })]);
    await expect(service.loginWithPIN('0501234567', '0123')).rejects.toThrow(UnauthorizedException);
  });
});
describe('retained staff OTP protection', () => {
  it('rejects mobile OTP requests without sending a code', async () => {
    const { db, service, sms } = build(); db.enqueue([account()]);
    await expect(service.requestOTP('0501234567')).rejects.toThrow(UnauthorizedException);
    expect(sms.sendOTP).not.toHaveBeenCalled();
  });
  it('cannot create or reclaim a mobile account through verification', async () => {
    const { db, service } = build(); db.enqueue([]);
    await expect(service.verifyOTP('0501234567', '123456')).rejects.toThrow(UnauthorizedException);
    db.assertDrained();
  });
  it('reports staff SMS delivery failure honestly and cleans up', async () => {
    const { db, service, sms } = build();
    sms.sendOTP.mockRejectedValue(new Error('offline'));
    db.enqueue([staff()]); db.enqueue([{ total: 0 }]); db.enqueue([{ id: SID }]); db.enqueue([]);
    await expect(service.requestOTP('0501234567')).rejects.toThrow(ServiceUnavailableException);
    db.assertDrained();
  });
  it('issues staff OTP only for a provisioned account', async () => {
    const { db, service } = build();
    db.enqueue([staff()]); db.enqueue([{ total: 0 }]); db.enqueue([{ id: SID }]);
    expect(await service.requestOTP('0501234567')).toHaveProperty('expiresIn', 600);
    db.assertDrained();
  });
  it('rejects a concurrently consumed OTP', async () => {
    const { db, service } = build();
    db.enqueue([staff()]);
    db.enqueue([{ id: SID, codeHash: new OTPService().hashOTP('123456'), attempts: 0, maxAttempts: 3, verifiedAt: null, expiresAt: new Date(Date.now() + 60000) }]);
    db.enqueue([{ id: SID }]); db.enqueue([]);
    await expect(service.verifyOTP('0501234567', '123456')).rejects.toThrow('already used or expired');
    db.assertDrained();
  });
});
describe('refresh cannot resurrect a replaced login', () => {
  const token = (service: AuthService, extra = {}) => (service as any).jwtService.generateRefreshToken({ userId: ID, phoneNumber: '+233501234567', role: 'passenger', sessionId: SID, ...extra });
  it('preserves the current session id on refresh', async () => {
    const { db, service, sessions } = build(); db.enqueue([account()]);
    const result = await service.refreshToken(token(service));
    expect((service as any).jwtService.verifyAccessToken(result.accessToken).sessionId).toBe(SID);
    expect(sessions.start).not.toHaveBeenCalled(); db.assertDrained();
  });
  it.each([null, 'other-session'])('rejects a session replaced in the database: %s', async (activeSessionId) => {
    const { db, service } = build(); db.enqueue([account({ activeSessionId })]);
    await expect(service.refreshToken(token(service))).rejects.toThrow(UnauthorizedException);
  });
  it('rejects legacy session-less refresh tokens', async () => {
    const { db, service } = build(); db.enqueue([account()]);
    await expect(service.refreshToken(token(service, { sessionId: undefined }))).rejects.toThrow(UnauthorizedException);
  });
  it('does not silently refresh a changed role', async () => {
    const { db, service } = build(); db.enqueue([account({ role: 'driver' })]);
    await expect(service.refreshToken(token(service))).rejects.toThrow(UnauthorizedException);
  });
  it('does not clear credentials on a database outage', async () => {
    const { db, service } = build(); db.enqueueFn(() => { throw new Error('offline'); });
    await expect(service.refreshToken(token(service))).rejects.toThrow(ServiceUnavailableException);
  });
});
