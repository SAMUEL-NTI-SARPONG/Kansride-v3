import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JWTService } from '@kansride/auth';
import { EventsGateway } from '../src/modules/events/events.gateway';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});
const userId = '00000000-0000-4000-8000-000000000001';
function setup() {
  const sessions = Object.assign(new EventEmitter(), { assertActive: vi.fn().mockResolvedValue({}) });
  const gateway = new EventsGateway({} as never, {} as never, {} as never, {} as never, sessions as never);
  const jwt = new JWTService({ accessSecret: 'test-access-secret', refreshSecret: 'test-refresh-secret', accessExpiry: '15m', refreshExpiry: '7d' });
  const socket = (sessionId = 'old', accountId = userId) => ({
    id: `${accountId}:${sessionId}`, data: {},
    handshake: { auth: { token: jwt.generateAccessToken({ userId: accountId, role: 'passenger', phoneNumber: '+233501234567', sessionId }) } },
    emit: vi.fn(), disconnect: vi.fn(), use: vi.fn(),
  });
  return { sessions, gateway, socket };
}
describe('socket session takeover', () => {
  it('immediately disconnects only old sessions for the same account', async () => {
    const { sessions, gateway, socket } = setup();
    const old = socket(); const current = socket('new'); const unrelated = socket('other', 'other-user');
    for (const client of [old, current, unrelated]) await gateway.handleConnection(client as never);
    sessions.emit('replaced', userId, 'new');
    expect(old.emit).toHaveBeenCalledWith('session:revoked', expect.any(Object));
    expect(old.disconnect).toHaveBeenCalledWith(true);
    expect(current.disconnect).not.toHaveBeenCalled();
    expect(unrelated.disconnect).not.toHaveBeenCalled();
  });
  it('rejects a revoked session during the handshake', async () => {
    const { sessions, gateway, socket } = setup(); const client = socket();
    sessions.assertActive.mockRejectedValue(new UnauthorizedException());
    await gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.use).not.toHaveBeenCalled();
  });
  it('blocks ride/GPS packets after revocation, before their handler runs', async () => {
    const { sessions, gateway, socket } = setup(); const client = socket();
    await gateway.handleConnection(client as never);
    sessions.assertActive.mockRejectedValue(new UnauthorizedException());
    const next = vi.fn(); client.use.mock.calls[0]![0](['driver:location', {}], next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(expect.any(Error)));
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
  it('does not log out a connected user during a database outage', async () => {
    const { sessions, gateway, socket } = setup(); const client = socket();
    await gateway.handleConnection(client as never);
    sessions.assertActive.mockRejectedValue(new ServiceUnavailableException());
    await gateway.checkSessions();
    expect(client.disconnect).not.toHaveBeenCalled();
    const next = vi.fn(); client.use.mock.calls[0]![0](['ride:join', {}], next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(expect.any(Error)));
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});
