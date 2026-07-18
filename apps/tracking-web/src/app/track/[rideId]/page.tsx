'use client';

import { useEffect, useState, useCallback } from 'react';
import { get } from '../../../lib/api';
import { subscribeToRide, onLocationUpdate, onRideUpdate, disconnect } from '../../../lib/socket';

interface RideData {
  id: string;
  status: string;
  pickupLatitude: string;
  pickupLongitude: string;
  pickupAddress: string | null;
  dropoffLatitude: string;
  dropoffLongitude: string;
  dropoffAddress: string | null;
  driverFirstName: string | null;
  vehicleColour: string | null;
  vehiclePlate: string | null;
  estimatedFare: number;
  estimatedDurationSeconds: number | null;
  rideType: string;
  createdAt: string;
}

interface DriverLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

const STATUS_STEPS = [
  'requested',
  'driver_assigned',
  'driver_en_route',
  'driver_arrived',
  'in_progress',
  'completed',
];

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

function getStatusColor(status: string): string {
  if (status === 'completed') return 'text-green-600';
  if (status.startsWith('cancelled') || status === 'no_driver_found') return 'text-red-600';
  if (status === 'in_progress') return 'text-blue-600';
  return 'text-amber-600';
}

function getProgressIndex(status: string): number {
  const idx = STATUS_STEPS.indexOf(status);
  return idx >= 0 ? idx : 0;
}

function formatETA(seconds: number | null): string {
  if (!seconds) return '--';
  const mins = Math.ceil(seconds / 60);
  return `${mins} min`;
}

function formatFare(pesewas: number): string {
  const cedis = (pesewas / 100).toFixed(2);
  return `GH₵ ${cedis}`;
}

export default function TrackRidePage({ params }: { params: Promise<{ rideId: string }> }) {
  const [rideId, setRideId] = useState<string>('');
  const [ride, setRide] = useState<RideData | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unwrap params
  useEffect(() => {
    params.then((p) => setRideId(p.rideId));
  }, [params]);

  const fetchRide = useCallback(async () => {
    if (!rideId) return;
    try {
      setLoading(true);
      const data = await get<RideData>(`/rides/${rideId}/track`);
      setRide(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ride');
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    if (!rideId) return;
    fetchRide();
  }, [rideId, fetchRide]);

  // WebSocket connection
  useEffect(() => {
    if (!rideId || !ride) return;

    subscribeToRide(rideId);

    onLocationUpdate((data) => {
      if (data.rideId === rideId) {
        setDriverLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp,
        });
      }
    });

    onRideUpdate((data) => {
      if (data.rideId === rideId && data.status) {
        setRide((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    });

    return () => {
      disconnect();
    };
  }, [rideId, ride]);

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
          <a href="/" className="mt-6 inline-block text-green-600 hover:text-green-700 font-medium">
            ← Back to home
          </a>
        </div>
      </div>
    );
  }

  const isCancelled = ride.status.startsWith('cancelled') || ride.status === 'no_driver_found';
  const isCompleted = ride.status === 'completed';
  const progressIdx = getProgressIndex(ride.status);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛺</span>
            <h1 className="text-lg font-bold text-green-700">KansRide</h1>
          </div>
          <span className="text-xs text-gray-400 font-mono">ID: {ride.id.slice(0, 8)}...</span>
        </div>
      </header>

      {/* Map Placeholder */}
      <div className="flex-1 min-h-[200px] bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center relative">
        <div className="text-center p-4">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="text-sm font-medium text-gray-600">Live Map</p>
          {driverLocation ? (
            <div className="mt-3 bg-white/80 backdrop-blur rounded-lg px-4 py-2 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">Driver Location</p>
              <p className="text-sm font-mono text-green-700">
                {driverLocation.latitude.toFixed(6)}, {driverLocation.longitude.toFixed(6)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Updated: {new Date(driverLocation.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-2">Waiting for driver location...</p>
          )}
        </div>
      </div>

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
                    : isCancelled
                      ? 'bg-red-500'
                      : 'bg-amber-500 animate-pulse'
                }`}
              ></span>
              <span className={`text-sm font-semibold ${getStatusColor(ride.status)}`}>
                {STATUS_MESSAGES[ride.status] || ride.status}
              </span>
            </div>
            {ride.estimatedDurationSeconds && !isCompleted && !isCancelled && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                ETA: {formatETA(ride.estimatedDurationSeconds)}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {!isCancelled && (
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
                  {ride.vehiclePlate && <span className="ml-2 font-mono">{ride.vehiclePlate}</span>}
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
                  {ride.pickupAddress || `${ride.pickupLatitude}, ${ride.pickupLongitude}`}
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
                  {ride.dropoffAddress || `${ride.dropoffLatitude}, ${ride.dropoffLongitude}`}
                </p>
              </div>
            </div>
          </div>

          {/* Fare */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">Estimated Fare</span>
            <span className="text-sm font-bold text-gray-800">{formatFare(ride.estimatedFare)}</span>
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
