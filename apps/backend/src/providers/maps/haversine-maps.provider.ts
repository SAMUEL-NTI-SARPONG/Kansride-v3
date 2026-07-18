import { Injectable } from '@nestjs/common';
import { IMapsProvider, Coordinate, DistanceResult } from './maps.interface';

@Injectable()
export class HaversineMapsProvider implements IMapsProvider {
  // Average tricycle speed in urban Ghana: ~25 km/h
  private readonly AVG_SPEED_KMH = 25;
  // Road winding factor (straight-line distance * factor = road distance)
  private readonly ROAD_FACTOR = 1.4;

  async getDistance(from: Coordinate, to: Coordinate): Promise<DistanceResult> {
    const straightLineKm = this.haversine(from.latitude, from.longitude, to.latitude, to.longitude);
    const roadDistanceKm = straightLineKm * this.ROAD_FACTOR;
    const distanceMeters = Math.round(roadDistanceKm * 1000);
    const durationSeconds = Math.round((roadDistanceKm / this.AVG_SPEED_KMH) * 3600);

    return { distanceMeters, durationSeconds };
  }

  async getRoute(from: Coordinate, to: Coordinate): Promise<{ distanceMeters: number; durationSeconds: number; polyline?: string }> {
    const result = await this.getDistance(from, to);
    return { ...result, polyline: undefined }; // No polyline for Haversine
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
