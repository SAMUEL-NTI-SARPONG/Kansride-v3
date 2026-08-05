import type { RideStatus } from '@kansride/types';

// Business rules
export const DRIVER_SUBSCRIPTION_AMOUNT_PESEWAS = 1000; // GHS 10 = 1000 pesewas
export const DRIVER_SUBSCRIPTION_DURATION_HOURS = 24;

// OTP
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RATE_LIMIT_WINDOW_MINUTES = 15;
export const OTP_RATE_LIMIT_MAX_REQUESTS = 3;

// JWT
export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '7d';

// Dispatch — the authoritative timing/radius contract for ride dispatch.
// `apps/backend/src/modules/rides/dispatch.service.ts` MUST import these
// instead of redeclaring local copies. See `docs/engineering/ENGINEERING_READINESS_REPORT.md`
// §1.1 "Dispatch 2→5 km, ≤5 drivers, offer TTL 30 s" and the consolidation
// commit `fix(dispatch): consolidate dispatch tuning` for the rationale. Any
// change to a value here moves the entire dispatch behaviour (radius escalation,
// eligibility staleness, no-driver timeout, max receivers); callers must not
// independently restat them.
export const MAX_DISPATCH_RADIUS_KM = 5;
export const DISPATCH_INITIAL_RADIUS_KM = 2;
export const DISPATCH_TIMEOUT_SECONDS = 30;
export const DRIVER_RESPONSE_TIMEOUT_SECONDS = 15;
// Offer TTL is the same value as DISPATCH_TIMEOUT_SECONDS but renamed to match
// the offered-payload `expiresAt` semantics used by DispatchService. Callers that
// distinguish "waits before no_driver_found" from "per-driver offer validity"
// use the constant identified by that semantics. Both currently share one value.
export const OFFER_TTL_SECONDS = DISPATCH_TIMEOUT_SECONDS;
export const MAX_OFFERED_DRIVERS = 5;
// A driver's location is considered fresh by dispatch when `drivers.updatedAt`
// is within this many milliseconds of `now`. The EventsGateway debounces
// `driver:location` writes to ~5 s (`LOCATION_DB_DEBOUNCE_MS`), and the client
// sends updates every `DRIVER_LOCATION_UPDATE_INTERVAL_MS` (10 s), so a 60 s
// cutoff is comfortably larger than the steady-state write cadence while being
// short enough to drop drivers who have disconnected or stalled mid-dispatch.
// The previous `LOCATION_STALE_THRESHOLD_MINUTES = 5` had no live consumer;
// keeping it would create a second, misleading source of truth.
export const DRIVER_LOCATION_MAX_AGE_MS = 60_000;

export const ACTIVE_RIDE_LOCATION_STATUSES: readonly RideStatus[] = [
  'driver_assigned',
  'driver_en_route',
  'driver_arrived',
  'waiting_for_passenger',
  'passenger_verified',
  'in_progress',
  'emergency_hold',
];

// Fare (all in pesewas)
export const FARE_BASE_PESEWAS = 200; // GHS 2
export const FARE_PER_KM_PESEWAS = 150; // GHS 1.50
export const FARE_PER_MINUTE_PESEWAS = 10; // GHS 0.10
export const FARE_MINIMUM_PESEWAS = 300; // GHS 3

// Location — client-side update cadence (mobile driver ping). The server-side
// debouncer is owned by the EventsGateway, not here.
export const DRIVER_LOCATION_UPDATE_INTERVAL_MS = 10000; // 10 seconds