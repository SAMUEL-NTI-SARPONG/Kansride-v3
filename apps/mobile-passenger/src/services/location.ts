// Passenger app location helpers — a focused subset of the driver abstraction.
// The passenger only needs one-time pickup acquisition (no continuous watch),
// so this module does not expose `startLocationWatch`. Permission / services
// states and acquisition are mapped to the same typed `LocationOutcome` so the
// home screen can render honest permission / unavailable / loaded states.

import * as Location from 'expo-location';
import type { LocationObject } from 'expo-location';

export type LocationOutcome =
  | { kind: 'granted' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'services-disabled' }
  | { kind: 'unavailable'; reason: string }
  | {
      kind: 'position';
      coords: { latitude: number; longitude: number; accuracy?: number; timestamp: number };
    };

export interface PermissionShape {
  status: 'granted' | 'undetermined' | 'denied';
  granted: boolean;
  canAskAgain: boolean;
}

export interface ProviderShape {
  locationServicesEnabled: boolean;
  backgroundModeEnabled?: boolean;
}

/** Map an expo permission response to a typed outcome. Pure/testable. */
export function mapPermissionOutcome(response: PermissionShape): LocationOutcome {
  if (response.status === 'granted' || response.granted) {
    return { kind: 'granted' };
  }
  return { kind: 'denied', canAskAgain: response.canAskAgain !== false };
}

/** Map an expo provider status to a typed outcome. Pure/testable. */
export function mapProviderOutcome(status: ProviderShape): LocationOutcome {
  if (status.locationServicesEnabled) return { kind: 'granted' };
  return { kind: 'services-disabled' };
}

type Coords = { latitude: number; longitude: number; accuracy?: number; timestamp: number };

const POSITION_TIMEOUT_MS = 12_000;

function coordsFromObject(loc: LocationObject): Coords {
  const { latitude, longitude, accuracy } = loc.coords;
  return { latitude, longitude, accuracy: accuracy ?? undefined, timestamp: loc.timestamp ?? Date.now() };
}

export async function ensureForegroundPermission(): Promise<LocationOutcome> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    const mapped = mapPermissionOutcome(current as unknown as PermissionShape);
    if (mapped.kind === 'granted') return mapped;
    const response = await Location.requestForegroundPermissionsAsync();
    return mapPermissionOutcome(response as unknown as PermissionShape);
  } catch (error) {
    return { kind: 'unavailable', reason: errorMessage(error) };
  }
}

export async function getForegroundPermissionState(): Promise<LocationOutcome> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    return mapPermissionOutcome(current as unknown as PermissionShape);
  } catch (error) {
    return { kind: 'unavailable', reason: errorMessage(error) };
  }
}

export async function getLocationServicesState(): Promise<LocationOutcome> {
  try {
    const status = await Location.getProviderStatusAsync();
    return mapProviderOutcome(status as unknown as ProviderShape);
  } catch (error) {
    return { kind: 'unavailable', reason: errorMessage(error) };
  }
}

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

function timeoutAfter(ms: number, reason: string): Promise<LocationOutcome> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ kind: 'unavailable', reason }), ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}