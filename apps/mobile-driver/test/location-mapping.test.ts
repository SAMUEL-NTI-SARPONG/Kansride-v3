import { describe, it, expect } from 'vitest';
import {
  mapPermissionOutcome,
  mapProviderOutcome,
} from '../src/services/location-mapping';

describe('mapPermissionOutcome — pure location-permission mapping', () => {
  it('maps a granted status', () => {
    expect(
      mapPermissionOutcome({ status: 'granted', granted: true, canAskAgain: true }),
    ).toEqual({ kind: 'granted' });
  });

  it('treats granted = true (regardless of status string) as granted', () => {
    // expo sometimes returns status 'undetermined' alongside granted=true
    // right after a synchronous grant; trust the convenience boolean.
    expect(
      mapPermissionOutcome({ status: 'undetermined', granted: true, canAskAgain: true }),
    ).toEqual({ kind: 'granted' });
  });

  it('maps a denied permission that can still be asked again', () => {
    const outcome = mapPermissionOutcome({ status: 'denied', granted: false, canAskAgain: true });
    expect(outcome.kind).toBe('denied');
    if (outcome.kind === 'denied') expect(outcome.canAskAgain).toBe(true);
  });

  it('maps a blocked permission (denied, canAskAgain false) — caller must deep-link to Settings', () => {
    const outcome = mapPermissionOutcome({ status: 'denied', granted: false, canAskAgain: false });
    expect(outcome.kind).toBe('denied');
    if (outcome.kind === 'denied') expect(outcome.canAskAgain).toBe(false);
  });

  it('never fabricates a granted outcome from a denied convenience flag', () => {
    expect(
      mapPermissionOutcome({ status: 'undetermined', granted: false, canAskAgain: false }),
    ).toEqual({ kind: 'denied', canAskAgain: false });
  });
});

describe('mapProviderOutcome — pure location-services mapping', () => {
  it('maps an enabled provider to granted regardless of gps/network availability', () => {
    expect(
      mapProviderOutcome({
        locationServicesEnabled: true,
        backgroundModeEnabled: false,
        gpsAvailable: true,
        networkAvailable: false,
        passiveAvailable: false,
      }),
    ).toEqual({ kind: 'granted' });
  });

  it('maps a disabled provider to services-disabled (does not fabricate coordinates)', () => {
    expect(
      mapProviderOutcome({ locationServicesEnabled: false, backgroundModeEnabled: false }),
    ).toEqual({ kind: 'services-disabled' });
  });
});