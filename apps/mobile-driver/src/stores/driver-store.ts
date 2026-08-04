import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import type { RideOffer } from '../api/socket';

const ACTIVE_RIDE_KEY = 'kansride_driver_active_ride';

function isTerminalStatus(status: string): boolean {
  return [
    'completed',
    'cancelled_by_passenger',
    'cancelled_by_driver',
    'cancelled_by_admin',
    'no_driver_found',
    'passenger_no_show',
    'driver_no_show',
  ].includes(status);
}

function rideFromApi(ride: Record<string, unknown>): ActiveRide {
  return {
    rideId: String(ride.id),
    status: ride.status as RideStatus,
    pickupAddress: typeof ride.pickupAddress === 'string' ? ride.pickupAddress : 'Pickup location',
    dropoffAddress: typeof ride.dropoffAddress === 'string' ? ride.dropoffAddress : 'Dropoff location',
    pickupLatitude: Number(ride.pickupLatitude),
    pickupLongitude: Number(ride.pickupLongitude),
    dropoffLatitude: Number(ride.dropoffLatitude),
    dropoffLongitude: Number(ride.dropoffLongitude),
    estimatedFarePesewas: Number(ride.estimatedFarePesewas),
  };
}

export type RideStatus =
  | 'driver_assigned'
  | 'driver_en_route'
  | 'driver_arrived'
  | 'waiting_for_passenger'
  | 'passenger_verified'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface ActiveRide {
  rideId: string;
  status: RideStatus;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  estimatedFarePesewas: number;
  passengerName?: string;
  passengerPhone?: string;
}

interface DriverState {
  isOnline: boolean;
  driverId: string | null;
  isApproved: boolean;
  subscriptionActive: boolean;
  subscriptionExpiresAt: string | null;
  currentOffer: RideOffer | null;
  activeRide: ActiveRide | null;
  offerExpiresAt: number | null;

  setOnline: (online: boolean) => void;
  setDriverId: (id: string | null) => void;
  setApproved: (approved: boolean) => void;
  setSubscription: (active: boolean, expiresAt?: string | null) => void;
  setCurrentOffer: (offer: RideOffer | null) => void;
  setActiveRide: (ride: ActiveRide | null) => void;
  updateRideStatus: (status: RideStatus) => void;
  setOfferExpiry: (expiresAt: number | null) => void;
  reset: () => void;
  hydrateActiveRide: () => Promise<void>;
}

export const useDriverStore = create<DriverState>((set, get) => ({
  isOnline: false,
  driverId: null,
  isApproved: false,
  subscriptionActive: false,
  subscriptionExpiresAt: null,
  currentOffer: null,
  activeRide: null,
  offerExpiresAt: null,

  setOnline: (online) => set({ isOnline: online }),
  setDriverId: (id) => set({ driverId: id }),
  setApproved: (approved) => set({ isApproved: approved }),
  setSubscription: (active, expiresAt) =>
    set({ subscriptionActive: active, subscriptionExpiresAt: expiresAt || null }),
  setCurrentOffer: (offer) =>
    set({
      currentOffer: offer,
      offerExpiresAt: offer ? Date.parse(offer.expiresAt) : null,
    }),
  setActiveRide: (ride) => {
    if (ride) {
      void AsyncStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(ride));
    } else {
      void AsyncStorage.removeItem(ACTIVE_RIDE_KEY);
    }
    set({ activeRide: ride, currentOffer: null, offerExpiresAt: null });
  },
  updateRideStatus: (status) =>
    set((state) => {
      if (!state.activeRide) return { activeRide: null };
      const activeRide = { ...state.activeRide, status };
      void AsyncStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(activeRide));
      return { activeRide };
    }),
  setOfferExpiry: (expiresAt) => set({ offerExpiresAt: expiresAt }),
  reset: () => {
    void AsyncStorage.removeItem(ACTIVE_RIDE_KEY);
    set({
      isOnline: false,
      driverId: null,
      isApproved: false,
      subscriptionActive: false,
      subscriptionExpiresAt: null,
      currentOffer: null,
      activeRide: null,
      offerExpiresAt: null,
    });
  },
  hydrateActiveRide: async () => {
    const stored = await AsyncStorage.getItem(ACTIVE_RIDE_KEY);
    if (!stored) return;
    try {
      const cached = JSON.parse(stored) as ActiveRide;
      set({ activeRide: cached });
      const remote = await api.get<Record<string, unknown>>(`/rides/${cached.rideId}`);
      if (isTerminalStatus(String(remote.status))) {
        get().reset();
        return;
      }
      const reconciled = rideFromApi(remote);
      await AsyncStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(reconciled));
      set({ activeRide: reconciled });
    } catch {
      get().reset();
    }
  },
}));
