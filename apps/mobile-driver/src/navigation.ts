export type NavigationTarget = 'pickup' | 'destination';

export function navigationTargetForStatus(status: string): NavigationTarget {
  return ['driver_assigned', 'driver_en_route', 'driver_arrived', 'waiting_for_passenger'].includes(status)
    ? 'pickup'
    : 'destination';
}

export function navigationUrl(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function navigationRegion(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length === 0 || points.some((point) => !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude))) return null;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    latitudeDelta: Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.01) * 1.5,
    longitudeDelta: Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.01) * 1.5,
  };
}
