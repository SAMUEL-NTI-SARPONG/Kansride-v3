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
    <div className="relative min-h-[300px] flex-1 overflow-hidden bg-[#DDE8E3] sm:min-h-[380px]" aria-label="Privacy-safe live tracking map">
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url(${trackingTileUrl.replace('{z}', '12').replace('{x}', '0').replace('{y}', '0')})`, backgroundSize: 'cover' }} />
      <div className="absolute inset-0 bg-gradient-to-br from-[#E7F2EF]/80 to-[#F6F0E6]/65" />
      {point ? <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${point.left}%`, top: `${point.top}%` }}><div className={`h-6 w-6 rounded-full border-4 border-white shadow-lg ${stale ? 'bg-amber-500' : 'bg-primary'}`} /><div className="mt-2 rounded-lg border border-white/80 bg-white/95 px-2.5 py-1.5 text-xs font-bold text-[#284844] shadow-sm">{stale ? 'Location may be stale' : 'Driver location'}</div></div> : <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm font-medium text-[#61736F]">Waiting for authorised driver location…</div>}
      <div className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded-lg border border-white/70 bg-white/90 px-2.5 py-1.5 text-[10px] font-medium text-[#61736F] shadow-sm">{location ? (age !== null ? `Updated ${Math.round(age / 1000)}s ago` : 'Location received') : 'No location yet'} · {trackingTileAttribution}</div>
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
      <div className="flex min-h-screen items-center justify-center bg-[#F6F0E6]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
          <p className="mt-4 text-sm font-semibold text-[#61736F]">Opening secure ride details…</p>
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F0E6] px-5">
        <div className="w-full max-w-sm rounded-3xl border border-[#DDD4C4] bg-[#FFFDF8] p-7 text-center shadow-panel">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl font-bold text-red-700">!</div>
          <h2 className="mb-2 text-xl font-extrabold text-[#173633]">Tracking unavailable</h2>
          <p className="text-sm leading-6 text-[#61736F]">{error || 'Unable to load ride data'}</p>
          <Link href="/" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-control hover:bg-primary-dark">
            Enter another link
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
    <div className="flex min-h-screen flex-col bg-[#F6F0E6]">
      {/* Header */}
      <header className="border-b border-[#DDD4C4] bg-[#FFFDF8]/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[10px] font-black text-white">KR</span>
            <div><h1 className="text-base font-extrabold tracking-[-0.025em] text-primary-dark">KansRide</h1><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#72817D]">Live tracking</p></div>
          </div>
          <span className="rounded-lg bg-[#EEE6D8] px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[#526963]">{ride.publicReference}</span>
        </div>
      </header>

      {connectionState !== 'connected' && !isEnded && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800">
          {connectionState === 'reconnecting' ? 'Reconnecting to live updates…' : 'Live updates disconnected. The page will retry automatically.'}
        </div>
      )}

      <TrackingMap location={privacySafeLocation(driverLocation)} />

      {/* Ride Details */}
      <div className="relative -mt-5 z-20 rounded-t-[28px] border-t border-[#DDD4C4] bg-[#FFFDF8] shadow-panel">
        <div className="mx-auto max-w-2xl space-y-5 px-5 pb-6 pt-4 sm:px-6">
          <div className="mx-auto h-1.5 w-11 rounded-full bg-[#D8CFBF]" />
          {/* Status Banner */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                  isCompleted
                    ? 'bg-green-500'
                    : isFailure
                      ? 'bg-red-500'
                      : isEnded
                        ? 'bg-gray-400'
                        : 'bg-amber-500 animate-pulse'
                }`}
              ></span>
              <span className={`text-base font-extrabold leading-5 ${getStatusColor(status)}`}>
                {STATUS_MESSAGES[status] || status}
              </span>
            </div>
            {ride.estimatedDurationSeconds && !isEnded && (
              <span className="shrink-0 rounded-full bg-[#DCEBE7] px-2.5 py-1 text-xs font-bold text-primary">
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
                        ? 'bg-primary border-primary'
                        : 'bg-white border-[#CFC6B7]'
                    }`}
                  ></div>
                ))}
              </div>
              <div className="relative h-1 rounded-full bg-[#DED6C8]">
                <div
                  className="absolute left-0 top-0 h-1 rounded-full bg-primary transition-all duration-500"
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
            <div className="flex items-center gap-3 rounded-2xl border border-[#E0D8CA] bg-[#F3EDE3] p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
                <span className="text-sm font-extrabold text-white">
                  {ride.driverFirstName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-[#173633]">{ride.driverFirstName}</p>
                <p className="mt-0.5 text-xs font-medium text-[#61736F]">
                  {ride.vehicleColour && <span>{ride.vehicleColour} Tricycle</span>}
                  {ride.maskedVehiclePlate && (
                    <span className="ml-2 font-mono">{ride.maskedVehiclePlate}</span>
                  )}
                </p>
              </div>
              <span className="rounded-full border border-[#CADFD9] bg-[#E7F2EF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">Verified trip</span>
            </div>
          )}

          {/* Locations */}
          <div className="rounded-2xl border border-[#E0D8CA] bg-white/70 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-[#A9D3C9] bg-primary"></span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#72817D]">Pickup</p>
                <p className="mt-0.5 text-sm font-semibold text-[#173633]">
                  {ride.pickupAddress || 'Pickup location'}
                </p>
              </div>
            </div>
            <div className="ml-1.5 h-5 border-l-2 border-dashed border-[#CFC6B7]"></div>
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <span className="inline-block h-3 w-3 rounded-sm border-2 border-[#F0BDB5] bg-[#B7473A]"></span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#72817D]">Dropoff</p>
                <p className="mt-0.5 text-sm font-semibold text-[#173633]">
                  {ride.dropoffAddress || 'Destination'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-[11px] text-gray-400 text-center pt-2">
            Privacy protected · shared by a KansRide passenger for safety tracking
          </p>
        </div>
      </div>
    </div>
  );
}
