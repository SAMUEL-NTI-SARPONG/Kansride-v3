import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { IRedisService } from './redis.interface';

@Injectable()
export class RedisService implements IRedisService, OnModuleDestroy {
  private readonly logger = new Logger('Redis');
  private readonly client: Redis;
  private connected = false;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.connected = true;
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (err) => {
      this.connected = false;
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.client.connect().catch((err) => {
      this.logger.error(`Failed to connect to Redis: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async geoAdd(key: string, longitude: number, latitude: number, member: string): Promise<void> {
    await this.client.geoadd(key, longitude, latitude, member);
  }

  async geoSearch(
    key: string,
    longitude: number,
    latitude: number,
    radiusKm: number,
  ): Promise<Array<{ member: string; distance: number }>> {
    const results = await this.client.georadius(
      key,
      longitude,
      latitude,
      radiusKm,
      'km',
      'WITHDIST',
      'ASC',
    );
    return (results as Array<[string, string]>).map(([member, dist]) => ({
      member,
      distance: parseFloat(dist),
    }));
  }

  async geoRemove(key: string, member: string): Promise<void> {
    await this.client.zrem(key, member);
  }

  async sAdd(key: string, member: string): Promise<void> {
    await this.client.sadd(key, member);
  }

  async sRem(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  async sMembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
