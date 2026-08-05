import { describe, expect, it } from 'vitest';
import { mapPoint, privacySafeLocation, trackingLocationStale, validTrackingCoordinate } from './tracking-map';

describe('tracking map privacy helpers', () => {
  it('validates coordinates and maps them to a marker position', () => {
    expect(validTrackingCoordinate(5.6, -0.2)).toBe(true);
    expect(validTrackingCoordinate(91, 0)).toBe(false);
    expect(mapPoint(0, 0)).toEqual({ left: 50, top: 50 });
  });
  it('classifies stale locations', () => {
    expect(trackingLocationStale('2026-01-01T00:00:00Z', Date.parse('2026-01-01T00:00:30Z'))).toBe(false);
    expect(trackingLocationStale('2026-01-01T00:00:00Z', Date.parse('2026-01-01T00:02:00Z'))).toBe(true);
  });
  it('keeps only privacy-safe location fields', () => {
    expect(privacySafeLocation({ publicReference: 'KR-private', latitude: 5.6, longitude: -0.2, timestamp: '2026-01-01T00:00:00Z' })).toEqual({ latitude: 5.6, longitude: -0.2, timestamp: '2026-01-01T00:00:00Z' });
    expect(privacySafeLocation({ publicReference: 'KR-private', latitude: 91, longitude: -0.2, timestamp: '2026-01-01T00:00:00Z' })).toBeNull();
  });
});
