import { describe, expect, it } from 'vitest';
import { driverLocationFallback, formatDriverFare, isCompletedRide, sumCompletedEarnings } from '../src/driver-history';

describe('driver history and earnings helpers', () => {
  it('uses address or coordinate fallbacks', () => {
    expect(driverLocationFallback('Pickup', 5, -1)).toBe('Pickup');
    expect(driverLocationFallback(null, '5.600', '-0.200')).toBe('5.600, -0.200');
  });
  it('counts only valid completed rides', () => {
    const records = [{ id: '1', status: 'completed', farePesewas: 500 }, { id: '2', status: 'cancelled_by_driver', farePesewas: 900 }, { id: '3', status: 'completed', farePesewas: null }];
    expect(isCompletedRide(records[0])).toBe(true);
    expect(sumCompletedEarnings(records)).toBe(500);
  });
  it('formats safe Ghana cedi values', () => {
    expect(formatDriverFare(1250)).toBe('GHS 12.50');
    expect(formatDriverFare(null)).toBe('--');
  });
});
