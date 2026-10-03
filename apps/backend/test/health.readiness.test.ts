import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Database } from '@kansride/db';
import { HealthController } from '../src/modules/health/health.controller';
import { MemoryRedisService } from '../src/redis/memory-redis.service';

afterEach(() => vi.useRealTimers());

function controller(execute = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] })) {
  const redis = new MemoryRedisService();
  return { health: new HealthController({ execute } as unknown as Database, redis), redis, execute };
}

describe('infrastructure readiness', () => {
  it('preserves a cheap independent liveness probe', () => {
    const { health, execute } = controller();
    expect(health.check()).toMatchObject({ status: 'ok', service: 'kansride-api' });
    expect(execute).not.toHaveBeenCalled();
  });
  it('requires a successful PostGIS query and a live Redis command', async () => {
    const { health, redis, execute } = controller();
    const read = vi.spyOn(redis, 'get');
    expect(await health.ready()).toMatchObject({ status: 'ok', checks: { database: true, redis: true } });
    expect(execute).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith('kansride:readiness');
  });
  it('returns 503 for a database outage without exposing connection details', async () => {
    const { health } = controller(vi.fn().mockRejectedValue(new Error('private database credentials')));
    try { await health.ready(); throw new Error('Expected readiness failure'); }
    catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ checks: { database: false, redis: true } });
      expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain('credentials');
    }
  });
  it('checks Redis even when an earlier connection was successful', async () => {
    const { health, redis } = controller();
    vi.spyOn(redis, 'get').mockRejectedValue(new Error('disconnected'));
    await expect(health.ready()).rejects.toThrow(ServiceUnavailableException);
  });
  it('bounds a stalled dependency below the host health-check deadline', async () => {
    vi.useFakeTimers();
    const { health } = controller(vi.fn(() => new Promise(() => {})));
    const result = health.ready();
    const assertion = expect(result).rejects.toThrow(ServiceUnavailableException);
    await vi.advanceTimersByTimeAsync(4000);
    await assertion;
  });
});
