import { create } from 'zustand';
import { DriverLocation, RideUpdate } from '../api/socket';

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
  id: string;
  name: string;
  phone: string;
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
  rideType: string;
  estimatedFare?: number;
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
    if (!currentRide) return;

    const statusMap: Record<string, RideStatus> = {
      searching: 'searching',
      driver_assigned: 'driver_assigned',
      en_route: 'en_route',
      arrived: 'arrived',
      in_progress: 'in_progress',
      completed: 'completed',
      cancelled: 'cancelled',
    };

    const newStatus = statusMap[data.status] || currentRide.status;
    set({
      rideStatus: newStatus,
      activeRide: {
        ...currentRide,
        status: newStatus,
        driver: data.driver || currentRide.driver,
      },
    });
  },

  resetRide: () =>
    set({ activeRide: null, rideStatus: 'idle', driverLocation: null }),
}));
