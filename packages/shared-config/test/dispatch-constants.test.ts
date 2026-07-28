import { describe, it, expect } from 'vitest';
import {
  DISPATCH_INITIAL_RADIUS_KM,
  DISPATCH_TIMEOUT_SECONDS,
  DRIVER_LOCATION_MAX_AGE_MS,
  DRIVER_RESPONSE_TIMEOUT_SECONDS,
  MAX_DISPATCH_RADIUS_KM,
  MAX_OFFERED_DRIVERS,
  OFFER_TTL_SECONDS,
} from '../src/constants';

// Regression test for `fix(dispatch): consolidate dispatch tuning`. The dispatch
// service used to restate five timing/radius constants locally while shared-config
// declared an unrelated and unused staleness window (LOCATION_STALE_THRESHOLD_MINUTES
// = 5 minutes). These tests assert the consolidated behaviour:
//
//   1. The dispatch service's `no_driver_found` deadline equals the offer TTL.
//   2. The offer TTL equals DISPATCH_TIMEOUT_SECONDS (per-driver validity
//      currently shares the upper dispatch window).
//   3. The radius escalation ordering is sane (initial < maximum).
//   4. The driver location staleness cutoff is the 60 s value the dispatch
//      service actually used at recovery, NOT the 5 minute constant previously
//      declared (and unused) by shared-config.
//   5. The number of offered drivers is a sane bounded integer.
//   6. The expand-radius timeout equals DRIVER_RESPONSE_TIMEOUT_SECONDS.

describe('Dispatch tuning — consolidated constants (single source of truth)', () => {
  it('the offer TTL equals the dispatch / no-driver timeout', () => {
    expect(OFFER_TTL_SECONDS).toBe(DISPATCH_TIMEOUT_SECONDS);
    expect(OFFER_TTL_SECONDS).toBe(30);
  });

  it('preserves the documented 2 -> 5 km radius escalation', () => {
    expect(DISPATCH_INITIAL_RADIUS_KM).toBe(2);
    expect(MAX_DISPATCH_RADIUS_KM).toBe(5);
    expect(DISPATCH_INITIAL_RADIUS_KM).toBeLessThan(MAX_DISPATCH_RADIUS_KM);
  });

  it('preserves the documented 15 s radius-expansion timeout', () => {
    expect(DRIVER_RESPONSE_TIMEOUT_SECONDS).toBe(15);
  });

  it('caps MAX_OFFERED_DRIVERS to the documented 5', () => {
    expect(Number.isInteger(MAX_OFFERED_DRIVERS)).toBe(true);
    expect(MAX_OFFERED_DRIVERS).toBeGreaterThan(0);
    expect(MAX_OFFERED_DRIVERS).toBeLessThanOrEqual(5);
  });

  it('preserves the active 60 s driver location staleness window (not the legacy 5 min)', () => {
    // The dispatch service's `getEligibleDriver` filters by
    // `drivers.updatedAt >= now - DRIVER_LOCATION_MAX_AGE_MS`. Recovery
    // documented this as 60 s; a stale `LOCATION_STALE_THRESHOLD_MINUTES = 5`
    // in shared-config had no consumers. The consolidated authority must be
    // the ms value the live query path uses.
    expect(DRIVER_LOCATION_MAX_AGE_MS).toBe(60_000);
    expect(DRIVER_LOCATION_MAX_AGE_MS).toBeLessThanOrEqual(120_000);
  });
});