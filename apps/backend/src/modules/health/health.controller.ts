import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import type { Database } from '@kansride/db';
import { DATABASE_TOKEN } from '../../database';
import { REDIS_SERVICE, type IRedisService } from '../../redis';

// A dependency outage must not leave hosting probes waiting indefinitely.
async function bounded(check: () => Promise<unknown>): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(check),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Readiness timeout')), 4000);
      }),
    ]);
    return true;
  } catch { return false; }
  finally { if (timeout) clearTimeout(timeout); }
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(REDIS_SERVICE) private readonly redis: IRedisService,
  ) {}

  @Get()
  @SkipThrottle()
  check() {
    return { status: 'ok', service: 'kansride-api', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @SkipThrottle()
  async ready() {
    const [database, redis] = await Promise.all([
      bounded(() => this.db.execute(sql`SELECT 1, postgis_version()`)),
      bounded(async () => {
        if (!this.redis.isConnected()) throw new Error('Redis not ready');
        await this.redis.get('kansride:readiness');
      }),
    ]);
    const result = {
      status: database && redis ? 'ok' : 'unavailable',
      service: 'kansride-api',
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    };
    if (!database || !redis) throw new ServiceUnavailableException(result);
    return result;
  }
}
