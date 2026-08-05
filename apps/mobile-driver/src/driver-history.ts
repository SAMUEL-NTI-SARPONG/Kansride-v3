export interface DriverHistoryRecord {
  id: string;
  status: string;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  pickupLatitude?: number | string | null;
  pickupLongitude?: number | string | null;
  dropoffLatitude?: number | string | null;
  dropoffLongitude?: number | string | null;
  farePesewas?: number | null;
  createdAt?: string | null;
  completedAt?: string | null;
  cancellationReason?: string | null;
}

export function driverLocationFallback(label: string | null | undefined, latitude: unknown, longitude: unknown): string {
  if (label?.trim()) return label.trim();
  const lat = Number(latitude); const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(3)}, ${lng.toFixed(3)}` : 'Unavailable';
}

export function isCompletedRide(record: Pick<DriverHistoryRecord, 'status' | 'farePesewas'>): boolean {
  return record.status === 'completed' && typeof record.farePesewas === 'number' && Number.isSafeInteger(record.farePesewas) && record.farePesewas >= 0;
}

export function sumCompletedEarnings(records: DriverHistoryRecord[]): number {
  return records.filter(isCompletedRide).reduce((total, record) => total + (record.farePesewas || 0), 0);
}

export function formatDriverFare(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? `GHS ${(value / 100).toFixed(2)}` : '--';
}
