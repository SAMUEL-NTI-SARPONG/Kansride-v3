// Typed mobile location abstraction over `expo-location` for the driver app.
//
// V1 scope is foreground-only. The driver app declares
// `ACCESS_BACKGROUND_LOCATION` + the iOS `location` UIBackgroundModes entry in
// app.json for the *next* planned V1.1 step, but this module never starts a
// background task; `watchPositionAsync` only delivers updates while the app is
// in the foreground (per expo-location docs). No background tracking is wired.
//
// The module never fabricates coordinates. Every acquisition surface returns a
// discriminated `LocationOutcome` (re-exported from the pure
// `location-mapping.ts` so callers can render honest states: permission
// denied, services disabled, acquisition timeout/failure, granted). The pure
// mapping from expo's permission/provider shapes to our typed outcomes is
// unit-tested in `test/location-mapping.test.ts` without touching native
// modules.

export { type LocationOutcome } from './location-mapping';

import * as Location from 'expo-location';
import type {
  LocationObject,
  LocationPermissionResponse,
  LocationProviderStatus,
  LocationOptions,
  LocationSubscription,
} from 'expo-location';
import {
  mapPermissionOutcome,
  mapProviderOutcome,
  type LocationOutcome,
} from './location-mapping';

const DEFAULT_WATCH_OPTIONS: LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  // Distance filter keeps the steady-state emission cadence reasonable and
  // matches the backend's 60 s location-freshness window. A 10 m filter also
  // avoids spamming the socket while the driver is stationary at a pickup.
  distanceInterval: 10,
  // Hard timeInterval caps the data rate even when the device is stationary
  // (distance filter would otherwise never fire). 10 s mirrors the existing
  // socket emission interval (`startLocationEmission`).
  timeInterval: 10_000,
};

const POSITION_TIMEOUT_MS = 12_000;

type Coords = { latitude: number; longitude: number; accuracy?: number; timestamp: number };

function coordsFromObject(loc: LocationObject): Coords {
  const { latitude, longitude, accuracy } = loc.coords;
  return { latitude, longitude, accuracy: accuracy ?? undefined, timestamp: loc.timestamp ?? Date.now() };
}

/** Request foreground location permission. Never requests background perms. */
export async function ensureForegroundPermission(): Promise<LocationOutcome> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    const mapped = mapPermissionOutcome(current as unknown as Parameters<typeof mapPermissionOutcome>[0]);
    if (mapped.kind === 'granted') return mapped;
    const response = await Location.requestForegroundPermissionsAsync();
    return mapPermissionOutcome(response as unknown as Parameters<typeof mapPermissionOutcome>[0]);
  } catch (error) {
    return { kind: 'unavailable', reason: errorMessage(error) };
  }
}

/** Inspect permission state without prompting. */
export async function getForegroundPermissionState(): Promise<LocationOutcome> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    return mapPermissionOutcome(current as unknown as Parameters<typeof mapPermissionOutcome>[0]);
  } catch (error) {
    return { kind: 'unavailable', reason: errorMessage(error) };
  }
}

/** Inspect device location-services status without prompting. */
export async function getLocationServicesState(): Promise<LocationOutcome> {
  try {
    const status = await Location.getProviderStatusAsync();
    return mapProviderOutcome(status as unknown as Parameters<typeof mapProviderOutcome>[0]);
  } catch (error) {
    return { kind: 'unavailable', reason: errorMessage(error) };
  }
}

/**
 * Acquire a one-time current position. Never fabricates coordinates. Returns a
 * typed `LocationOutcome`; `unavailable` covers native throws and timeout.
 */
export async function acquireCurrentPosition(): Promise<LocationOutcome> {
  try {
    const position = (await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeoutAfter(POSITION_TIMEOUT_MS, 'Location acquisition timed out'),
    ])) as LocationObject | LocationOutcome;
    if ('kind' in position) return position;
    return { kind: 'position', coords: coordsFromObject(position) };
  } catch (error) {
    return { kind: 'unavailable', reason: errorMessage(error) };
  }
}

// ─── Continuous watch (driver only) ───────────────────────────────────────
//
// A single active watcher is tracked in a module-level slot so calling
// `startLocationWatch` again implicitly stops the previous watcher — this
// prevents duplicate watchers leaking across go-online toggles / session
// restore. `stopLocationWatch` is the idempotent cleanup.

let activeWatch: LocationSubscription | null = null;

/**
 * Start a foreground location watcher. Stops any existing watcher first to
 * guarantee at most one active watcher. Calls `onPosition` for each fix and
 * returns a typed outcome; `granted` means the watch is running, any other
 * outcome is the honest reason it could not start. No coordinates are
 * fabricated on failure.
 */
export async function startLocationWatch(onPosition: (coords: Coords) => void): Promise<LocationOutcome> {
  try {
    const permission = await ensureForegroundPermission();
    if (permission.kind !== 'granted') return permission;

    const services = await getLocationServicesState();
    if (services.kind !== 'granted') return services;

    stopLocationWatch();
    const subscription = await Location.watchPositionAsync(
      DEFAULT_WATCH_OPTIONS,
      (loc) => {
        onPosition(coordsFromObject(loc));
      },
      (error) => {
        // Watch errors are non-fatal; the next toggle re-arms the watcher.
        // Intentionally not logged to console to avoid leaking location state.
        void error;
      },
    );
    activeWatch = subscription;
    return { kind: 'granted' };
  } catch (error) {
    return { kind: 'unavailable', reason: errorMessage(error) };
  }
}

/** Stop the active foreground watcher, if any. Idempotent. */
export function stopLocationWatch(): void {
  if (activeWatch) {
    try {
      activeWatch.remove();
    } catch {
      // Subscription already gone; ignore.
    }
    activeWatch = null;
  }
}

export function hasActiveLocationWatch(): boolean {
  return activeWatch !== null;
}

// ─── helpers ──────────────────────────────────────────────────────────────

function timeoutAfter(ms: number, reason: string): Promise<LocationOutcome> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ kind: 'unavailable', reason }), ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}