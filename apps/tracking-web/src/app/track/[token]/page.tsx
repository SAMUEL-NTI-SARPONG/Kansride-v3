'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { get } from '../../../lib/api';
import { connectTracking, onConnectionState, onLocationUpdate, onRideUpdate, onTrackingError, disconnect } from '../../../lib/socket';
import type {
  PublicDriverLocationPayload,
  PublicTrackingSnapshot,
  RideStatus,
} from '@kansride/types';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { mapPoint, privacySafeLocation, trackingLocationAge, trackingLocationStale, trackingTileAttribution, trackingTileUrl } from '../../../lib/tracking-map';

const reviewMode = developmentReviewModeEnabled(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_UI_REVIEW_MODE,
);

function reviewRide(timestamp: string): PublicTrackingSnapshot {
  return {
    publicReference: 'KR-REVIEW-001',
    status: 'driver_en_route',
    rideType: 'standard_tricycle',
    pickupAddress: 'Market Circle, Takoradi',
    dropoffAddress: 'Airport Roundabout, Takoradi',
    driverFirstName: 'Kwame',
    vehicleColour: 'Green',
    maskedVehiclePlate: 'WR •• 24',
    estimatedDurationSeconds: 480,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    updatedAt: timestamp,
  };
}

const STATUS_STEPS = [
  'requested',
  'driver_assigned',
  'driver_en_route',
  'driver_arrived',
  'in_progress',
  'completed',
];

// Terminal ride statuses, mirroring the backend PublicTrackingService
// TERMINAL_STATUSES set. When a ride reaches one of these, the tracking
// grant is revoked and the gateway force-disconnects; the client must treat
// them as ended (red indicator, no further updates) rather than as in-flight.
const TERMINAL_STATUSES = new Set<RideStatus>([
  'completed',
  'cancelled_by_passenger',
  'cancelled_by_driver',
  'cancelled_by_admin',
  'no_driver_found',
  'passenger_no_show',
  'driver_no_show',
  'payment_failed',
]);

// Terminal-failure statuses are terminal AND not 'completed' — they render red
// instead of green.
const TERMINAL_FAILURE_STATUSES: ReadonlySet<RideStatus> = new Set<RideStatus>(
  [
    'cancelled_by_passenger',
    'cancelled_by_driver',
    'cancelled_by_admin',
    'no_driver_found',
    'passenger_no_show',
    'driver_no_show',
    'payment_failed',
  ],
);

const STATUS_MESSAGES: Record<string, string> = {
  draft: 'Preparing your ride...',
  requested: 'Looking for a driver...',
  searching: 'Looking for a driver...',
  driver_offered: 'Looking for a driver...',
  driver_assigned: 'Driver found! On the way to pickup',
  driver_en_route: 'Driver heading to pickup point',
  driver_arrived: 'Driver has arrived at pickup',
  waiting_for_passenger: 'Driver waiting for you',
  passenger_verified: 'Ride starting...',
  in_progress: 'Ride in progress',
  completed: 'Ride completed! Thank you',
  cancelled_by_passenger: 'This ride was cancelled',
  cancelled_by_driver: 'This ride was cancelled',
  cancelled_by_admin: 'This ride was cancelled',
  no_driver_found: 'No driver available at this time',
  passenger_no_show: 'Ride cancelled — passenger no show',
  driver_no_show: 'Ride cancelled — driver no show',
  payment_pending: 'Payment pending...',
  payment_failed: 'Payment issue — please contact support',
  disputed: 'Ride under review',
  emergency_hold: 'Ride on hold — safety review',
};

function isTerminalStatus(status: RideStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

function isTerminalFailure(status: RideStatus): boolean {
  return TERMINAL_FAILURE_STATUSES.has(status);
}

function getStatusColor(status: RideStatus): string {
  if (status === 'completed') return 'text-green-600';
  if (isTerminalFailure(status)) return 'text-red-600';
  if (status === 'in_progress') return 'text-blue-600';
  return 'text-amber-600';
}

function getProgressIndex(status: RideStatus): number {
  const idx = STATUS_STEPS.indexOf(status);
  return idx >= 0 ? idx : -1;
}

function formatETA(seconds: number | null): string {
  if (!seconds) return '--';
  const mins = Math.ceil(seconds / 60);
  return `${mins} min`;
}

const BACKGROUND_REFETCH_INTERVAL_MS = 45_000;

function TrackingMap({ location }: { location: { latitude: number; longitude: number; timestamp: string } | null }) {
  const point = location ? mapPoint(location.latitude, location.longitude) : null;
  const stale = trackingLocationStale(location?.timestamp || null);
  const age = location ? trackingLocationAge(location.timestamp) : null;
  return (
    <div className="flex-1 min-h-[240px] bg-slate-100 relative overflow-hidden" aria-label="Privacy-safe live tracking map">
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url(${trackingTileUrl.replace('{z}', '12').replace('{x}', '0').replace('{y}', '0')})`, backgroundSize: 'cover' }} />
      <div className="absolute inset-0 bg-gradient-to-br from-green-50/70 to-blue-50/70" />
      {point ? <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${point.left}%`, top: `${point.top}%` }}><div className={`h-5 w-5 rounded-full border-4 border-white shadow-lg ${stale ? 'bg-amber-500' : 'bg-green-600'}`} /><div className="mt-2 rounded bg-white/90 px-2 py-1 text-xs font-medium text-gray-700">{stale ? 'Location may be stale' : 'Driver location'}</div></div> : <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-500">Waiting for authorised driver location…</div>}
      <div className="absolute bottom-2 left-2 z-10 rounded bg-white/90 px-2 py-1 text-[10px] text-gray-500">{location ? (age !== null ? `Updated ${Math.round(age / 1000)}s ago` : 'Location received') : 'No location yet'} · {trackingTileAttribution}</div>
    </div>
  );
}

export default function TrackRidePage({ params }: { params: Promise<{ token: string }> }) {
  const [trackingToken, setTrackingToken] = useState<string>('');
  const [ride, setRide] = useState<PublicTrackingSnapshot | null>(null);
  const [driverLocation, setDriverLocation] = useState<PublicDriverLocationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'reconnecting'>('reconnecting');
  const isUiReview = reviewMode && trackingToken === 'ui-review';

  // High-water mark of the furthest ladder step the ride has visibly reached.
  // Several live (non-terminal) statuses fall outside the STATUS_STEPS ladder
  // (waiting_for_passenger, passenger_verified, payment_pending, disputed,
  // emergency_hold). Without clamping, entering any of them reset the
  // progress UI to 'Requested' (index 0), visibly rewinding the ride. We
  // remember the maximum ladder index reached and never let the rendered
  // position fall below it.
  const progressHighWater = useRef<number>(0);

  // Unwrap params. The Next 15 `params` Promise can resolve after unmount; guard
  // with a cancelled flag so we never call setState on an unmounted component.
  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      if (!cancelled) setTrackingToken(p.token);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const fetchRide = useCallback(async () => {
    if (!trackingToken) return;
    if (isUiReview) {
      const timestamp = new Date().toISOString();
      const data = reviewRide(timestamp);
      setRide(data);
      setDriverLocation({
        publicReference: data.publicReference,
        latitude: 4.9016,
        longitude: -1.7831,
        timestamp,
      });
      progressHighWater.current = getProgressIndex(data.status);
      setConnectionState('connected');
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await get<PublicTrackingSnapshot>(
        `/rides/public-track/${encodeURIComponent(trackingToken)}`,
      );
      setRide(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ride');
    } finally {
      setLoading(false);
    }
  }, [trackingToken, isUiReview]);

  useEffect(() => {
    if (!trackingToken) return;
    void fetchRide();
  }, [trackingToken, fetchRide]);

  // WebSocket connection + listeners.
  useEffect(() => {
    if (!trackingToken || !ride || isUiReview) return;

    connectTracking(trackingToken);

    const removeLocationListener = onLocationUpdate((data) => {
      if (data.publicReference === ride.publicReference) {
        setDriverLocation(data);
      }
    });

    const removeRideListener = onRideUpdate((data) => {
      if (data.publicReference !== ride.publicReference) return;
      const status = data.status as RideStatus;
      setRide((prev) => (prev ? { ...prev, status } : prev));

      const ladderIdx = getProgressIndex(status);
      if (ladderIdx > progressHighWater.current) {
        progressHighWater.current = ladderIdx;
      }

      if (isTerminalStatus(status)) {
        // The backend revokes the grant and force-disconnects on a terminal
        // transition. Break the reconnect/404 loop locally too: stop
        // listening and disconnect so background refetch + socket.io
        // auto-reconnect don't hammer the now-revoked token.
        removeLocationListener();
        removeRideListener();
        disconnect();
      }
    });

    const removeConnectionListener = onConnectionState(setConnectionState);
    const removeErrorListener = onTrackingError((data) => {
      // Token invalid/expired/revoked: surface an honest terminal notice and
      // stop awaiting further updates rather than rendering the last-known
      // status as if the ride were still live.
      setError(data?.message || 'This tracking link has expired or is no longer available.');
      removeLocationListener();
      removeRideListener();
      disconnect();
    });

    // Mark the high-water once we have a known ride status so the initial
    // render starts at the correct ladder position (and never regresses).
    const initialIdx = getProgressIndex(ride.status as RideStatus);
    if (initialIdx > progressHighWater.current) {
      progressHighWater.current = initialIdx;
    }

    return () => {
      removeLocationListener();
      removeConnectionListener();
      removeErrorListener();
      disconnect();
    };
    // ride?.publicReference intentionally used as the connection key; depending
    // on the whole ride object would reconnect on every status update.
  }, [trackingToken, ride?.publicReference, isUiReview]);

  // Background polling + refetch-on-visible fallback. The websocket is the
  // primary channel, but if it silently drops or the tab was backgrounded long
  // enough for the socket to be torn down without an update arriving, the page
  // would otherwise display stale state forever with no recovery. A low-
  // frequency fetch keeps the status honest, gated on the ride not having
  // ended so we don't keep poking a revoked token.
  useEffect(() => {
    if (!trackingToken || isUiReview) return;

    const refetchIfActive = () => {
      const current = ride;
      if (!current || !isTerminalStatus(current.status as RideStatus)) {
        // Don't toggle the loading spinner for a background refresh; it would
        // flash the full-screen loader on every tick.
        void get<PublicTrackingSnapshot>(
          `/rides/public-track/${encodeURIComponent(trackingToken)}`,
        )
          .then((data) => {
            setRide(data);
            const ladderIdx = getProgressIndex(data.status as RideStatus);
            if (ladderIdx > progressHighWater.current) {
              progressHighWater.current = ladderIdx;
            }
          })
          .catch(() => {
            // A 404 here means the token is gone; the websocket error path
            // (or the next visible-refetch) will surface the honest state.
          });
      }
    };

    const interval = setInterval(refetchIfActive, BACKGROUND_REFETCH_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetchIfActive();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // Re-arm when the token or ride identity changes; a status-only update
    // must not restart the interval.
  }, [trackingToken, ride?.publicReference, isUiReview]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ride details...</p>
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-4">
          <p className="text-5xl mb-4">🚫</p>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Ride Not Found</h2>
          <p className="text-gray-500">{error || 'Unable to load ride data'}</p>
          <Link href="/" className="mt-6 inline-block text-green-600 hover:text-green-700 font-medium">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  const status = ride.status as RideStatus;
  const isEnded = isTerminalStatus(status);
  const isCompleted = status === 'completed';
  const isFailure = isTerminalFailure(status);
  const progressIdx = Math.max(progressHighWater.current, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛺</span>
            <h1 className="text-lg font-bold text-green-700">KansRide</h1>
          </div>
          <span className="text-xs text-gray-400 font-mono">{ride.publicReference}</span>
        </div>
      </header>

      {connectionState !== 'connected' && !isEnded && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800">
          {connectionState === 'reconnecting' ? 'Reconnecting to live updates…' : 'Live updates disconnected. The page will retry automatically.'}
        </div>
      )}

      <TrackingMap location={privacySafeLocation(driverLocation)} />

      {/* Ride Details */}
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* Status Banner */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  isCompleted
                    ? 'bg-green-500'
                    : isFailure
                      ? 'bg-red-500'
                      : isEnded
                        ? 'bg-gray-400'
                        : 'bg-amber-500 animate-pulse'
                }`}
              ></span>
              <span className={`text-sm font-semibold ${getStatusColor(status)}`}>
                {STATUS_MESSAGES[status] || status}
              </span>
            </div>
            {ride.estimatedDurationSeconds && !isEnded && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                ETA: {formatETA(ride.estimatedDurationSeconds)}
              </span>
            )}
          </div>

          {/* Progress Bar — shown for active and completed rides, hidden once
              the ride ends in a failure. The position is clamped to the
              high-water mark so out-of-ladder statuses don't rewind it. */}
          {!isFailure && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                {STATUS_STEPS.map((step, i) => (
                  <div
                    key={step}
                    className={`w-3 h-3 rounded-full border-2 ${
                      i <= progressIdx
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-gray-300'
                    }`}
                  ></div>
                ))}
              </div>
              <div className="relative h-1 bg-gray-200 rounded-full">
                <div
                  className="absolute left-0 top-0 h-1 bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(progressIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400">Requested</span>
                <span className="text-[10px] text-gray-400">Completed</span>
              </div>
            </div>
          )}

          {/* Driver Info */}
          {ride.driverFirstName && (
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-700 font-bold text-sm">
                  {ride.driverFirstName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{ride.driverFirstName}</p>
                <p className="text-xs text-gray-500">
                  {ride.vehicleColour && <span>{ride.vehicleColour} Tricycle</span>}
                  {ride.maskedVehiclePlate && (
                    <span className="ml-2 font-mono">{ride.maskedVehiclePlate}</span>
                  )}
                </p>
              </div>
              <span className="text-2xl">🛺</span>
            </div>
          )}

          {/* Locations */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 border-2 border-green-200"></span>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Pickup</p>
                <p className="text-sm text-gray-800">
                  {ride.pickupAddress || 'Pickup location'}
                </p>
              </div>
            </div>
            <div className="ml-1.5 border-l-2 border-dashed border-gray-300 h-4"></div>
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 border-2 border-red-200"></span>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Dropoff</p>
                <p className="text-sm text-gray-800">
                  {ride.dropoffAddress || 'Destination'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-[11px] text-gray-400 text-center pt-2">
            Shared by a KansRide passenger for safety tracking
          </p>
        </div>
      </div>
    </div>
  );
}
