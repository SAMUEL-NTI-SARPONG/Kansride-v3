import { create } from 'zustand';
import { RideOffer } from '../api/socket';

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
  subscriptionActive: boolean;
  subscriptionExpiresAt: string | null;
  currentOffer: RideOffer | null;
  activeRide: ActiveRide | null;
  offerExpiresAt: number | null;

  setOnline: (online: boolean) => void;
  setDriverId: (id: string | null) => void;
  setSubscription: (active: boolean, expiresAt?: string | null) => void;
  setCurrentOffer: (offer: RideOffer | null) => void;
  setActiveRide: (ride: ActiveRide | null) => void;
  updateRideStatus: (status: RideStatus) => void;
  setOfferExpiry: (expiresAt: number | null) => void;
  reset: () => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  isOnline: false,
  driverId: null,
  subscriptionActive: false,
  subscriptionExpiresAt: null,
  currentOffer: null,
  activeRide: null,
  offerExpiresAt: null,

  setOnline: (online) => set({ isOnline: online }),
  setDriverId: (id) => set({ driverId: id }),
  setSubscription: (active, expiresAt) =>
    set({ subscriptionActive: active, subscriptionExpiresAt: expiresAt || null }),
  setCurrentOffer: (offer) =>
    set({ currentOffer: offer, offerExpiresAt: offer ? Date.now() + 30000 : null }),
  setActiveRide: (ride) => set({ activeRide: ride, currentOffer: null, offerExpiresAt: null }),
  updateRideStatus: (status) =>
    set((state) => ({
      activeRide: state.activeRide ? { ...state.activeRide, status } : null,
    })),
  setOfferExpiry: (expiresAt) => set({ offerExpiresAt: expiresAt }),
  reset: () =>
    set({
      isOnline: false,
      driverId: null,
      subscriptionActive: false,
      subscriptionExpiresAt: null,
      currentOffer: null,
      activeRide: null,
      offerExpiresAt: null,
    }),
}));
