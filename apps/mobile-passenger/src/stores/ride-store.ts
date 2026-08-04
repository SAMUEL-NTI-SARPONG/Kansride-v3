import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get as apiGet } from '../api/client';
import { DriverLocation, RideUpdate } from '../api/socket';
import type { RideType } from '@kansride/types';

const ACTIVE_RIDE_KEY = 'kansride_passenger_active_ride';

function mapRideStatus(status: string): RideStatus {
  const statusMap: Record<string, RideStatus> = {
    requested: 'searching',
    searching: 'searching',
    driver_offered: 'searching',
    driver_assigned: 'driver_assigned',
    driver_en_route: 'en_route',
    driver_arrived: 'arrived',
    waiting_for_passenger: 'arrived',
    passenger_verified: 'in_progress',
    in_progress: 'in_progress',
    completed: 'completed',
    cancelled_by_passenger: 'cancelled',
    cancelled_by_driver: 'cancelled',
    cancelled_by_admin: 'cancelled',
    no_driver_found: 'cancelled',
    passenger_no_show: 'cancelled',
    driver_no_show: 'cancelled',
  };
  return statusMap[status] || 'searching';
}

function activeRideFromApi(ride: Record<string, unknown>): ActiveRide {
  return {
    id: String(ride.id),
    status: mapRideStatus(String(ride.status)),
    pickupAddress: typeof ride.pickupAddress === 'string' ? ride.pickupAddress : 'Pickup location',
    dropoffAddress: typeof ride.dropoffAddress === 'string' ? ride.dropoffAddress : 'Dropoff location',
    pickupLatitude: Number(ride.pickupLatitude),
    pickupLongitude: Number(ride.pickupLongitude),
    dropoffLatitude: Number(ride.dropoffLatitude),
    dropoffLongitude: Number(ride.dropoffLongitude),
    rideType: ride.rideType as RideType,
    estimatedFarePesewas: Number(ride.estimatedFarePesewas),
    verificationPin: typeof ride.verificationPin === 'string' ? ride.verificationPin : '',
  };
}

export type RideStatus =
  | 'idle'
  | 'requesting'
  | 'searching'
  | 'driver_assigned'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface RideDriver {
  name: string;
  vehicle: string;
  plateNumber: string;
  rating: number;
}

export interface ActiveRide {
  id: string;
  status: RideStatus;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  rideType: RideType;
  estimatedFarePesewas: number;
  verificationPin: string;
  driver?: RideDriver;
}

interface RideState {
  activeRide: ActiveRide | null;
  rideStatus: RideStatus;
  driverLocation: DriverLocation | null;

  // Actions
  setActiveRide: (ride: ActiveRide | null) => void;
  setRideStatus: (status: RideStatus) => void;
  setDriverLocation: (location: DriverLocation | null) => void;
  updateFromSocket: (data: RideUpdate) => void;
  resetRide: () => void;
  hydrateActiveRide: () => Promise<void>;
}

export const useRideStore = create<RideState>((set, get) => ({
  activeRide: null,
  rideStatus: 'idle',
  driverLocation: null,

  setActiveRide: (ride) => {
    if (ride) {
      void AsyncStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(ride));
    } else {
      void AsyncStorage.removeItem(ACTIVE_RIDE_KEY);
    }
    set({ activeRide: ride, rideStatus: ride?.status || 'idle' });
  },

  setRideStatus: (status) => {
    const currentRide = get().activeRide;
    if (currentRide) {
      const updated = { ...currentRide, status };
      void AsyncStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(updated));
      set({ rideStatus: status, activeRide: updated });
    } else {
      set({ rideStatus: status });
    }
  },

  setDriverLocation: (location) => set({ driverLocation: location }),

  updateFromSocket: (data) => {
    const currentRide = get().activeRide;
    if (!currentRide || data.rideId !== currentRide.id) return;

    const statusMap: Record<string, RideStatus> = {
      requested: 'searching',
      searching: 'searching',
      driver_offered: 'searching',
      driver_assigned: 'driver_assigned',
      driver_en_route: 'en_route',
      driver_arrived: 'arrived',
      waiting_for_passenger: 'arrived',
      passenger_verified: 'in_progress',
      in_progress: 'in_progress',
      completed: 'completed',
      payment_pending: 'completed',
      payment_failed: 'completed',
      cancelled_by_passenger: 'cancelled',
      cancelled_by_driver: 'cancelled',
      cancelled_by_admin: 'cancelled',
      no_driver_found: 'cancelled',
      passenger_no_show: 'cancelled',
      driver_no_show: 'cancelled',
    };

    const newStatus = statusMap[data.status] || currentRide.status;
    set({
      rideStatus: newStatus,
      activeRide: {
        ...currentRide,
        status: newStatus,
        driver: data.driver
          ? {
              name: [data.driver.firstName, data.driver.lastName]
                .filter(Boolean)
                .join(' '),
              vehicle: [data.driver.vehicleColour, data.driver.vehicleMake, data.driver.vehicleModel]
                .filter(Boolean)
                .join(' '),
              plateNumber: data.driver.vehicleRegistration,
              rating: data.driver.rating,
            }
          : currentRide.driver,
      },
    });
  },

  resetRide: () => {
    void AsyncStorage.removeItem(ACTIVE_RIDE_KEY);
    set({ activeRide: null, rideStatus: 'idle', driverLocation: null });
  },

  hydrateActiveRide: async () => {
    const stored = await AsyncStorage.getItem(ACTIVE_RIDE_KEY);
    if (!stored) return;
    try {
      const cached = JSON.parse(stored) as ActiveRide;
      set({ activeRide: cached, rideStatus: cached.status });
      const remote = await apiGet<Record<string, unknown>>(`/rides/${cached.id}`);
      if (['completed', 'cancelled_by_passenger', 'cancelled_by_driver', 'cancelled_by_admin', 'no_driver_found'].includes(String(remote.status))) {
        get().resetRide();
        return;
      }
      const reconciled = activeRideFromApi(remote);
      await AsyncStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(reconciled));
      set({ activeRide: reconciled, rideStatus: reconciled.status });
    } catch {
      get().resetRide();
    }
  },
}));
