export type TrackingShareState = 'active' | 'expired' | 'revoked' | 'unavailable';

export function trackingShareState(expiresAt: string | null, revoked: boolean, now = new Date()): TrackingShareState {
  if (revoked) return 'revoked';
  if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) return 'unavailable';
  return Date.parse(expiresAt) <= now.getTime() ? 'expired' : 'active';
}

export function emergencyCallUrl(phone: string | undefined): string | null {
  const value = phone?.trim();
  return value ? `tel:${value}` : null;
}

export function safeRideReference(id: string): string {
  return id.slice(0, 8);
}
