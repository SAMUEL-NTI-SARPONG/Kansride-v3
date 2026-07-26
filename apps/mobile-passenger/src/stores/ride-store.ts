import { create } from 'zustand';
import { DriverLocation, RideUpdate } from '../api/socket';
import type { RideType } from '@kansride/types';

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
}

export const useRideStore = create<RideState>((set, get) => ({
  activeRide: null,
  rideStatus: 'idle',
  driverLocation: null,

  setActiveRide: (ride) =>
    set({ activeRide: ride, rideStatus: ride?.status || 'idle' }),

  setRideStatus: (status) => {
    set({ rideStatus: status });
    const currentRide = get().activeRide;
    if (currentRide) {
      set({ activeRide: { ...currentRide, status } });
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

  resetRide: () =>
    set({ activeRide: null, rideStatus: 'idle', driverLocation: null }),
}));
