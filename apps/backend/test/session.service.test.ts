import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ServiceUnavailableException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Database, users } from '@kansride/db';
import { JWTService } from '@kansride/auth';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { SessionService } from '../src/modules/auth/session.service';
import { makeDbStub } from './helpers/drizzle-mock';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});
const payload = { userId: '00000000-0000-4000-8000-000000000001', role: 'passenger', sessionId: '00000000-0000-4000-8000-000000000002' };
const row = { id: payload.userId, role: payload.role, status: 'active', activeSessionId: payload.sessionId };
const setup = () => {
  const db = makeDbStub();
  return { db, service: new SessionService(db as unknown as Database) };
};
describe('one active server-side session', () => {
  it('rotates a UUID and notifies old sockets only after persistence', async () => {
    const { db, service } = setup();
    const replaced = vi.fn(); service.on('replaced', replaced);
    db.enqueue([{ id: payload.userId }]);
    const first = await service.start(row as typeof users.$inferSelect);
    db.enqueue([{ id: payload.userId }]);
    const second = await service.start(row as typeof users.$inferSelect);
    expect(first).not.toBe(second);
    expect(replaced).toHaveBeenLastCalledWith(payload.userId, second);
  });
  it('does not revoke a newer session when an old logout loses its conditional write', async () => {
    const { db, service } = setup(); const replaced = vi.fn(); service.on('replaced', replaced);
    db.enqueue([]); await service.end({ ...payload, phoneNumber: '+233501234567' });
    expect(replaced).not.toHaveBeenCalled();
  });
  it('accepts the exact persisted session', async () => {
    const { db, service } = setup(); db.enqueue([row]);
    await expect(service.assertActive(payload)).resolves.toEqual(row);
  });
  it.each([
    { activeSessionId: 'replaced' }, { activeSessionId: null },
    { status: 'suspended' }, { role: 'driver' },
  ])('rejects invalid account/session state: %j', async (change) => {
    const { db, service } = setup(); db.enqueue([{ ...row, ...change }]);
    await expect(service.assertActive(payload)).rejects.toThrow(UnauthorizedException);
  });
  it('rejects a session-less legacy token before database work', async () => {
    const { db, service } = setup();
    await expect(service.assertActive({ ...payload, sessionId: undefined })).rejects.toThrow(UnauthorizedException);
    db.assertDrained();
  });
  it('reports an outage without pretending credentials were revoked', async () => {
    const { db, service } = setup(); db.enqueueFn(() => { throw new Error('offline'); });
    await expect(service.assertActive(payload)).rejects.toThrow(ServiceUnavailableException);
  });
  it('rejects replaced sessions at the HTTP guard, not only on refresh', async () => {
    const { db, service } = setup(); db.enqueue([{ ...row, activeSessionId: 'new-session' }]);
    const jwt = new JWTService({ accessSecret: 'test-access-secret', refreshSecret: 'test-refresh-secret', accessExpiry: '15m', refreshExpiry: '7d' });
    const request = { headers: { authorization: `Bearer ${jwt.generateAccessToken({ ...payload, phoneNumber: '+233501234567' })}` } };
    const context = { getHandler: () => () => undefined, getClass: () => class {}, switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    await expect(new AuthGuard(new Reflector(), service).canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
