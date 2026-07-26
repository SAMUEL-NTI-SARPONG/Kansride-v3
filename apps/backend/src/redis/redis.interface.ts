export interface IRedisService {
  // Key-value operations
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  expire(key: string, ttlSeconds: number): Promise<void>;

  // Geo operations (for driver locations)
  geoAdd(key: string, longitude: number, latitude: number, member: string): Promise<void>;
  geoSearch(
    key: string,
    longitude: number,
    latitude: number,
    radiusKm: number,
  ): Promise<Array<{ member: string; distance: number }>>;
  geoRemove(key: string, member: string): Promise<void>;

  // Set operations
  sAdd(key: string, member: string): Promise<void>;
  sRem(key: string, member: string): Promise<void>;
  sMembers(key: string): Promise<string[]>;

  // Health
  isConnected(): boolean;
}

export const REDIS_SERVICE = 'REDIS_SERVICE';
