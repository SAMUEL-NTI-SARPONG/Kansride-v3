import { describe, expect, it } from 'vitest';
import { markerIsStale, privacySafeDriverMarker, privacySafeRideMarker } from '../src/lib/live-map';

describe('admin live map helpers', () => {
  it('identifies stale marker timestamps', () => {
    expect(markerIsStale('2026-01-01T00:00:00Z', Date.parse('2026-01-01T00:00:30Z'))).toBe(false);
    expect(markerIsStale('2026-01-01T00:00:00Z', Date.parse('2026-01-01T00:02:00Z'))).toBe(true);
  });
  it('filters private driver and passenger fields from map projections', () => {
    expect(privacySafeDriverMarker({ id: 'd1', name: 'Driver', phone: 'secret', isOnline: true, createdAt: 'now' })).toEqual({ id: 'd1', label: 'Driver', online: true, createdAt: 'now' });
    expect(privacySafeRideMarker({ id: 'r1', status: 'in_progress', passengerName: 'Private', driverName: 'Driver', createdAt: 'now' })).toEqual({ id: 'r1', status: 'in_progress', assigned: true, createdAt: 'now' });
  });
});
