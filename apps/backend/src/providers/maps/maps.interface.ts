export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface DistanceResult {
  distanceMeters: number;
  durationSeconds: number;
}

export interface IMapsProvider {
  getDistance(from: Coordinate, to: Coordinate): Promise<DistanceResult>;
  getRoute(from: Coordinate, to: Coordinate): Promise<{ distanceMeters: number; durationSeconds: number; polyline?: string }>;
}

export const MAPS_PROVIDER = 'MAPS_PROVIDER';
