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
        return new MemoryRedisService();
      },
    },
  ],
  exports: [REDIS_SERVICE],
})
export class RedisModule {}
