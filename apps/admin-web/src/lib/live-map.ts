export function markerIsStale(updatedAt: string | null | undefined, now = Date.now()): boolean {
  if (!updatedAt) return true;
  const timestamp = Date.parse(updatedAt);
  return !Number.isFinite(timestamp) || now - timestamp > 60_000;
}

export function privacySafeDriverMarker(driver: { id: string; name: string; phone: string; isOnline: boolean; createdAt: string }) {
  return { id: driver.id, label: driver.name, online: driver.isOnline, createdAt: driver.createdAt };
}

export function privacySafeRideMarker(ride: { id: string; status: string; passengerName: string; driverName: string | null; createdAt: string }) {
  return { id: ride.id, status: ride.status, assigned: Boolean(ride.driverName), createdAt: ride.createdAt };
}
