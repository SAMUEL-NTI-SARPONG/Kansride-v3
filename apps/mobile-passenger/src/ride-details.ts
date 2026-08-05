export interface PassengerRideDetailRecord {
  id: string;
  status: string;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  pickupLatitude?: number | string | null;
  pickupLongitude?: number | string | null;
  dropoffLatitude?: number | string | null;
  dropoffLongitude?: number | string | null;
  rideType?: string | null;
  estimatedDistanceMeters?: number | null;
  estimatedDurationSeconds?: number | null;
  estimatedFarePesewas?: number | null;
  actualFarePesewas?: number | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  completedAt?: string | Date | null;
  cancellationReason?: string | null;
  rating?: number | null;
  ratingComment?: string | null;
  driver?: {
    name?: string | null;
    vehicle?: string | null;
    rating?: number | null;
  } | null;
}

export interface PassengerRideDetail {
  id: string;
  status: string;
  statusLabel: string;
  pickup: string;
  destination: string;
  rideType: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  estimatedFarePesewas: number | null;
  actualFarePesewas: number | null;
  requestedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  cancellationReason: string | null;
  driver: {
    name: string;
    vehicle: string;
    rating: number | null;
  } | null;
  rating: number | null;
  ratingComment: string | null;
}

function coordinate(value: number | string | null | undefined): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function locationFallback(
  label: string | null | undefined,
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined,
): string {
  if (label?.trim()) return label.trim();
  const lat = coordinate(latitude);
  const lng = coordinate(longitude);
  return lat !== null && lng !== null ? `${lat.toFixed(3)}, ${lng.toFixed(3)}` : 'Unavailable';
}

export function formatGhsFromPesewas(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? `GHS ${(value / 100).toFixed(2)}`
    : '--';
}

export function formatRideStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isRideRatingEligible(detail: Pick<PassengerRideDetail, 'status' | 'rating'>): boolean {
  return detail.status === 'completed' && detail.rating === null;
}

export function transformPassengerRideDetail(record: PassengerRideDetailRecord): PassengerRideDetail {
  return {
    id: record.id,
    status: record.status,
    statusLabel: formatRideStatus(record.status),
    pickup: locationFallback(record.pickupAddress, record.pickupLatitude, record.pickupLongitude),
    destination: locationFallback(record.dropoffAddress, record.dropoffLatitude, record.dropoffLongitude),
    rideType: record.rideType?.trim() || 'Unavailable',
    distanceMeters: Number.isFinite(Number(record.estimatedDistanceMeters)) ? Number(record.estimatedDistanceMeters) : null,
    durationSeconds: Number.isFinite(Number(record.estimatedDurationSeconds)) ? Number(record.estimatedDurationSeconds) : null,
    estimatedFarePesewas: record.estimatedFarePesewas ?? null,
    actualFarePesewas: record.actualFarePesewas ?? null,
    requestedAt: record.createdAt ? new Date(record.createdAt).toISOString() : null,
    updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null,
    completedAt: record.completedAt ? new Date(record.completedAt).toISOString() : null,
    cancellationReason: record.cancellationReason?.trim() || null,
    driver: record.driver ? {
      name: record.driver.name?.trim() || 'Unavailable',
      vehicle: record.driver.vehicle?.trim() || 'Unavailable',
      rating: record.driver.rating ?? null,
    } : null,
    rating: record.rating ?? null,
    ratingComment: record.ratingComment ?? null,
  };
}
