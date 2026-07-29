// Pure typed-location outcome mapping, isolated from `expo-location` native
// imports so it can be unit-tested in Node without a native module host.
// `location.ts` wraps the native calls and feeds shapes here.

export type LocationOutcome =
  | { kind: 'granted' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'services-disabled' }
  | { kind: 'unavailable'; reason: string }
  | {
      kind: 'position';
      coords: { latitude: number; longitude: number; accuracy?: number; timestamp: number };
    };

/**
 * Minimal projection of expo's `LocationPermissionResponse`. We accept the
 * raw shape here and never import expo-modules-core, so the suite runs in
 * plain Node. The contract is: granted === GRANTED || `granted === true`.
 */
export interface PermissionShape {
  status: 'granted' | 'undetermined' | 'denied';
  granted: boolean;
  canAskAgain: boolean;
}

export interface ProviderShape {
  locationServicesEnabled: boolean;
  backgroundModeEnabled?: boolean;
  gpsAvailable?: boolean;
  networkAvailable?: boolean;
  passiveAvailable?: boolean;
}

export function mapPermissionOutcome(response: PermissionShape): LocationOutcome {
  if (response.status === 'granted' || response.granted) {
    return { kind: 'granted' };
  }
  return { kind: 'denied', canAskAgain: response.canAskAgain !== false };
}

export function mapProviderOutcome(status: ProviderShape): LocationOutcome {
  if (status.locationServicesEnabled) return { kind: 'granted' };
  return { kind: 'services-disabled' };
}