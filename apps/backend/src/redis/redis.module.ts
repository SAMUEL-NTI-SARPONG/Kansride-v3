import { Module, Global } from '@nestjs/common';
import { REDIS_SERVICE } from './redis.interface';
import { RedisService } from './redis.service';
import { MemoryRedisService } from './memory-redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_SERVICE,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          return new RedisService();
        }
        if (process.env.NODE_ENV === 'production') {
          throw new Error('REDIS_URL is required in production; in-memory dispatch is development-only');
        }
        return new MemoryRedisService();
      },
    },
  ],
  exports: [REDIS_SERVICE],
})
export class RedisModule {}
