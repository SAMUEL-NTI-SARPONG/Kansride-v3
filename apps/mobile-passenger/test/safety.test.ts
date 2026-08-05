import { describe, expect, it } from 'vitest';
import { emergencyCallUrl, safeRideReference, trackingShareState } from '../src/safety';

describe('passenger safety helpers', () => {
  it('classifies active, expired, revoked and unavailable shares', () => {
    expect(trackingShareState('2026-01-01T00:00:00Z', false, new Date('2025-01-01'))).toBe('active');
    expect(trackingShareState('2026-01-01T00:00:00Z', false, new Date('2027-01-01'))).toBe('expired');
    expect(trackingShareState('2026-01-01T00:00:00Z', true)).toBe('revoked');
    expect(trackingShareState(null, false)).toBe('unavailable');
  });
  it('constructs emergency links only for configured values', () => {
    expect(emergencyCallUrl(' +233200000000 ')).toBe('tel:+233200000000');
    expect(emergencyCallUrl('')).toBeNull();
  });
  it('uses a short non-secret ride reference', () => {
    expect(safeRideReference('12345678-1234-1234-1234-123456789abc')).toBe('12345678');
  });
});
