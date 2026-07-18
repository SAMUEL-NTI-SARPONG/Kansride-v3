import { Injectable, Logger } from '@nestjs/common';
import { IRedisService } from './redis.interface';

interface GeoEntry {
  member: string;
  longitude: number;
  latitude: number;
}

@Injectable()
export class MemoryRedisService implements IRedisService {
  private readonly logger = new Logger('MemoryRedis');
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();
  private readonly geoStore = new Map<string, GeoEntry[]>();
  private readonly setStore = new Map<string, Set<string>>();

  constructor() {
    this.logger.warn('Using in-memory Redis fallback. Install Redis for production use.');
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async geoAdd(key: string, longitude: number, latitude: number, member: string): Promise<void> {
    const entries = this.geoStore.get(key) || [];
    const existingIdx = entries.findIndex((e) => e.member === member);
    if (existingIdx >= 0) {
      entries[existingIdx] = { member, longitude, latitude };
    } else {
      entries.push({ member, longitude, latitude });
    }
    this.geoStore.set(key, entries);
  }

  async geoSearch(
    key: string,
    longitude: number,
    latitude: number,
    radiusKm: number,
  ): Promise<Array<{ member: string; distance: number }>> {
    const entries = this.geoStore.get(key) || [];
    const results: Array<{ member: string; distance: number }> = [];

    for (const entry of entries) {
      const distance = this.haversineDistance(latitude, longitude, entry.latitude, entry.longitude);
      if (distance <= radiusKm) {
        results.push({ member: entry.member, distance });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  async geoRemove(key: string, member: string): Promise<void> {
    const entries = this.geoStore.get(key) || [];
    this.geoStore.set(
      key,
      entries.filter((e) => e.member !== member),
    );
  }

  async sAdd(key: string, member: string): Promise<void> {
    const set = this.setStore.get(key) || new Set<string>();
    set.add(member);
    this.setStore.set(key, set);
  }

  async sRem(key: string, member: string): Promise<void> {
    const set = this.setStore.get(key);
    if (set) set.delete(member);
  }

  async sMembers(key: string): Promise<string[]> {
    const set = this.setStore.get(key);
    return set ? Array.from(set) : [];
  }

  isConnected(): boolean {
    return true; // Always "connected" in memory mode
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
