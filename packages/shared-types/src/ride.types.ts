import type { PaymentMethod } from './payment.types';

export type RideStatus =
  | 'draft'
  | 'requested'
  | 'searching'
  | 'driver_offered'
  | 'driver_assigned'
  | 'driver_en_route'
  | 'driver_arrived'
  | 'waiting_for_passenger'
  | 'passenger_verified'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_passenger'
  | 'cancelled_by_driver'
  | 'cancelled_by_admin'
  | 'no_driver_found'
  | 'passenger_no_show'
  | 'driver_no_show'
  | 'payment_pending'
  | 'payment_failed'
  | 'disputed'
  | 'emergency_hold';

export type RideType = 'standard_tricycle' | 'priority_tricycle' | 'shared' | 'parcel_delivery';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  landmark?: string;
}

export interface Ride {
  id: string;
  passengerId: string;
  driverId?: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  status: RideStatus;
  rideType: RideType;
  estimatedFare: number;
  actualFare?: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
  verificationPin?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface Driver {
  id: string;
  userId: string;
  licenseNumber: string;
  vehicleId?: string;
  rating: number;
  isOnline: boolean;
  isActive: boolean;
  subscriptionExpiresAt?: Date;
  currentLocation?: Location;
  completedRides: number;
}

export interface Passenger {
  id: string;
  userId: string;
  rating: number;
  preferredPaymentMethod: PaymentMethod;
  completedRides: number;
}
