import { afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ create: vi.fn(), on: vi.fn(), end: vi.fn() }));
vi.mock('pg', () => ({
  Pool: class {
    constructor(options: unknown) { mock.create(options); }
    on(event: string, handler: (error: unknown) => void) { mock.on(event, handler); return this; }
    async end() { mock.end(); }
  },
}));
vi.mock('drizzle-orm/node-postgres', () => ({ drizzle: () => ({}) }));
import { closeDb, getDb } from '../src/db';

afterEach(async () => { await closeDb(); vi.restoreAllMocks(); });

describe('hosted PostgreSQL resilience', () => {
  it('bounds connection and query waits and reuses the application pool', () => {
    expect(getDb('postgresql://test:test@localhost:5432/test')).toBe(getDb('postgresql://test:test@localhost:5432/test'));
    expect(mock.create).toHaveBeenCalledOnce();
    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ connectionTimeoutMillis: 5000, query_timeout: 15000, statement_timeout: 15000 }));
  });
  it('handles idle-client errors without logging private connection information', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    getDb('postgresql://test:test@localhost:5432/test');
    const handler = mock.on.mock.calls.find(([event]) => event === 'error')?.[1];
    expect(handler).toBeTypeOf('function');
    expect(() => handler(new Error('private connection details'))).not.toThrow();
    expect(log).toHaveBeenCalledWith('[DB] Idle connection lost; the pool will reconnect on the next request');
  });
});
