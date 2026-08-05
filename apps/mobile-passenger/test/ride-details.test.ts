import { describe, expect, it } from 'vitest';
import { formatGhsFromPesewas, formatRideStatus, isRideRatingEligible, transformPassengerRideDetail } from '../src/ride-details';

describe('passenger ride detail transformation', () => {
  const base = { id: 'ride-1', status: 'completed', pickupLatitude: '5.6', pickupLongitude: '-0.2', dropoffLatitude: 5.7, dropoffLongitude: -0.3, rideType: 'standard_tricycle', estimatedFarePesewas: 500, actualFarePesewas: 600, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T01:00:00Z', rating: null };

  it('uses coordinates when labels are unavailable and preserves fare/times', () => {
    const detail = transformPassengerRideDetail(base);
    expect(detail.pickup).toBe('5.600, -0.200');
    expect(detail.destination).toBe('5.700, -0.300');
    expect(detail.actualFarePesewas).toBe(600);
    expect(detail.requestedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('formats statuses and Ghana cedi values safely', () => {
    expect(formatRideStatus('cancelled_by_passenger')).toBe('Cancelled By Passenger');
    expect(formatGhsFromPesewas(1250)).toBe('GHS 12.50');
    expect(formatGhsFromPesewas(null)).toBe('--');
  });

  it('allows rating only for completed unrated rides', () => {
    expect(isRideRatingEligible(transformPassengerRideDetail(base))).toBe(true);
    expect(isRideRatingEligible(transformPassengerRideDetail({ ...base, rating: 5 }))).toBe(false);
    expect(isRideRatingEligible(transformPassengerRideDetail({ ...base, status: 'in_progress' }))).toBe(false);
  });
});
