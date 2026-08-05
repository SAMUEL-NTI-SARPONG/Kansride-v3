import type { PublicDriverLocationPayload } from '@kansride/types';

export function validTrackingCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function trackingLocationAge(timestamp: string, now = Date.now()): number | null {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? Math.max(0, now - parsed) : null;
}

export function trackingLocationStale(timestamp: string | null, now = Date.now()): boolean {
  if (!timestamp) return true;
  const age = trackingLocationAge(timestamp, now);
  return age === null || age > 60_000;
}

export function privacySafeLocation(location: PublicDriverLocationPayload | null): { latitude: number; longitude: number; timestamp: string } | null {
  if (!location || !validTrackingCoordinate(location.latitude, location.longitude)) return null;
  return { latitude: location.latitude, longitude: location.longitude, timestamp: location.timestamp };
}

export function mapPoint(latitude: number, longitude: number): { left: number; top: number } {
  return { left: ((longitude + 180) / 360) * 100, top: ((90 - latitude) / 180) * 100 };
}

export const trackingTileUrl = process.env.NEXT_PUBLIC_TRACKING_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const trackingTileAttribution = process.env.NEXT_PUBLIC_TRACKING_TILE_ATTRIBUTION || '© OpenStreetMap contributors';
