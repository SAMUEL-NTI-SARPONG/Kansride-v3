import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRedisService } from '../src/redis/memory-redis.service';

afterEach(() => vi.useRealTimers());
describe('development account limiter', () => {
  it('admits at most five concurrent attempts per fixed window', async () => {
    const redis = new MemoryRedisService();
    const allowed = await Promise.all(Array.from({ length: 20 }, () => redis.consumeRateLimit('account', 5, 900)));
    expect(allowed.filter(Boolean)).toHaveLength(5);
  });
  it('expires the original window without extending it on blocked attempts', async () => {
    vi.useFakeTimers();
    const redis = new MemoryRedisService();
    expect(await redis.consumeRateLimit('account', 1, 900)).toBe(true);
    await vi.advanceTimersByTimeAsync(899000);
    expect(await redis.consumeRateLimit('account', 1, 900)).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await redis.consumeRateLimit('account', 1, 900)).toBe(true);
  });
});
