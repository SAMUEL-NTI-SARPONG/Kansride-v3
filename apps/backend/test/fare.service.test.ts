import { describe, it, expect } from 'vitest';
import { FareService } from '../src/modules/rides/fare.service';
import {
  FARE_BASE_PESEWAS as BASE,
  FARE_PER_KM_PESEWAS as PER_KM,
  FARE_PER_MINUTE_PESEWAS as PER_MIN,
  FARE_MINIMUM_PESEWAS as MINIMUM,
} from '@kansride/config';

describe('FareService integer-pesewa invariants', () => {
  const fare = new FareService();

  it('exposes the canonical shared-config constants unchanged', () => {
    expect(BASE).toBe(200);
    expect(PER_KM).toBe(150);
    expect(PER_MIN).toBe(10);
    expect(MINIMUM).toBe(300);
  });

  it('returns integer pesewas on every field across representative fare shapes', () => {
    const samples = [
      { distanceMeters: 0, durationSeconds: 0, type: 'standard_tricycle' as const },
      { distanceMeters: 1_000, durationSeconds: 60, type: 'standard_tricycle' as const },
      { distanceMeters: 5_000, durationSeconds: 600, type: 'priority_tricycle' as const },
      { distanceMeters: 12_345, durationSeconds: 1_837, type: 'shared' as const },
      { distanceMeters: 99_999, durationSeconds: 60, type: 'parcel_delivery' as const },
      { distanceMeters: 333, durationSeconds: 7, type: 'standard_tricycle' as const },
    ];
    for (const sample of samples) {
      const result = fare.calculateFare(sample.distanceMeters, sample.durationSeconds, sample.type);
      expect(Number.isInteger(result.baseFarePesewas)).toBe(true);
      expect(Number.isInteger(result.distanceFarePesewas)).toBe(true);
      expect(Number.isInteger(result.timeFarePesewas)).toBe(true);
      expect(Number.isInteger(result.totalFarePesewas)).toBe(true);
    }
  });
});

describe('FareService calculation', () => {
  const fare = new FareService();

  it('applies the minimum fare before any priority multiplier', () => {
    const zero = fare.calculateFare(0, 0, 'standard_tricycle');
    expect(zero.totalFarePesewas).toBe(MINIMUM);
    // Minimum applies BEFORE the multiplier so a near-zero priority fare is
    // ceil(MINIMUM * 1.5), not ceil((MINIMUM * 1.5)) — same value here but the
    // guarantee is that the multiplier never lowers the floor.
    const zeroPriority = fare.calculateFare(0, 0, 'priority_tricycle');
    expect(zeroPriority.totalFarePesewas).toBe(Math.ceil(MINIMUM * 1.5));
  });

  it('sums base + ceil(distanceKm * PER_KM) + ceil(durationMin * PER_MIN) for a mid trip', () => {
    const result = fare.calculateFare(5_000, 600, 'standard_tricycle');
    expect(result.baseFarePesewas).toBe(BASE);
    expect(result.distanceFarePesewas).toBe(Math.ceil(5 * PER_KM));
    expect(result.timeFarePesewas).toBe(Math.ceil(10 * PER_MIN));
    expect(result.totalFarePesewas).toBe(BASE + Math.ceil(5 * PER_KM) + Math.ceil(10 * PER_MIN));
  });

  it('applies the priority multiplier using ceil after multiplication, leaving components intact', () => {
    const standard = fare.calculateFare(5_000, 600, 'standard_tricycle');
    const priority = fare.calculateFare(5_000, 600, 'priority_tricycle');
    // Components are unaffected by the multiplier; only the total is scaled.
    expect(priority.baseFarePesewas).toBe(standard.baseFarePesewas);
    expect(priority.distanceFarePesewas).toBe(standard.distanceFarePesewas);
    expect(priority.timeFarePesewas).toBe(standard.timeFarePesewas);
    expect(priority.totalFarePesewas).toBe(Math.ceil(standard.totalFarePesewas * 1.5));
    // No fractional pesewas ever leave the boundary even after the 1.5× multiplier.
    expect(Number.isInteger(priority.totalFarePesewas)).toBe(true);
  });

  it('rounds distance and time components up — never truncates toward zero', () => {
    const result = fare.calculateFare(1, 1, 'standard_tricycle');
    expect(result.distanceFarePesewas).toBe(1); // ceil(0.001 km * 150) = ceil(0.15) = 1
    expect(result.timeFarePesewas).toBe(1); // ceil(1/60 min * 10) = ceil(0.1666..) = 1
  });

  it('treats shared and parcel_delivery as standard_priced in the current implementation', () => {
    const standard = fare.calculateFare(5_000, 600, 'standard_tricycle');
    expect(fare.calculateFare(5_000, 600, 'shared').totalFarePesewas).toBe(standard.totalFarePesewas);
    expect(fare.calculateFare(5_000, 600, 'parcel_delivery').totalFarePesewas).toBe(standard.totalFarePesewas);
  });

  it('defaults an omitted rideType to standard_tricycle (no multiplier)', () => {
    const omitted = fare.calculateFare(5_000, 600);
    expect(omitted.totalFarePesewas).toBe(fare.calculateFare(5_000, 600, 'standard_tricycle').totalFarePesewas);
  });
});

describe('FareService is robust to pathological inputs (defense-in-depth)', () => {
  const fare = new FareService();

  it('clamps a zero-distance, zero-time priority ride to the minimum-before-multiplier', () => {
    expect(fare.calculateFare(0, 0, 'priority_tricycle').totalFarePesewas).toBe(Math.ceil(MINIMUM * 1.5));
  });

  it('does not return NaN or Infinity for representative numeric inputs', () => {
    for (const distance of [0, 1, 1_000, 10_000, 100_000]) {
      for (const duration of [0, 1, 60, 600, 6_000]) {
        const result = fare.calculateFare(distance, duration, 'standard_tricycle');
        expect(Number.isFinite(result.totalFarePesewas)).toBe(true);
      }
    }
  });
});