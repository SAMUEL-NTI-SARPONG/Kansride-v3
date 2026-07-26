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

export interface FareBreakdown {
  baseFarePesewas: number;
  distanceFarePesewas: number;
  timeFarePesewas: number;
  totalFarePesewas: number;
}

export interface CreateRideResponse {
  id: string;
  status: RideStatus;
  rideType: RideType;
  estimatedFarePesewas: number;
  estimatedDistanceMeters: number | null;
  estimatedDurationSeconds: number | null;
  fareBreakdown: FareBreakdown;
}

/**
 * Canonical private realtime payload for a persisted ride lifecycle change.
 *
 * Monetary values are integer pesewas. Dates cross the socket boundary as
 * ISO-8601 strings rather than Date instances.
 */
export interface RideUpdatePayload {
  rideId: string;
  status: RideStatus;
  previousStatus?: RideStatus;
  driverId: string | null;
  rideType: RideType;
  estimatedFarePesewas: number;
  actualFarePesewas: number | null;
  createdAt: string;
  updatedAt: string;
  cancelledBy?: string;
  cancelledByRole?: string;
  cancellationReason?: string | null;
  /** @deprecated Use cancellationReason. Retained for existing clients. */
  reason?: string;
  cancelledAt?: string;
}

/** Private offer delivered only to the addressed authenticated driver. */
export interface RideOfferPayload {
  rideId: string;
  rideType: RideType;
  pickupAddress: string | null;
  pickupLandmark: string | null;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffAddress: string | null;
  dropoffLandmark: string | null;
  dropoffLatitude: number;
  dropoffLongitude: number;
  estimatedFarePesewas: number;
  estimatedDistanceMeters: number | null;
  estimatedDurationSeconds: number | null;
  distanceToPickupMeters: number;
  offeredAt: string;
  expiresAt: string;
}

export interface RideAcceptResult {
  rideId: string;
  success: boolean;
  message: string;
}

/** Passenger-authorized capability used to share a live ride safely. */
export interface PublicTrackingLink {
  trackingToken: string;
  trackingPath: string;
  expiresAt: string;
}

/**
 * Minimized public tracking snapshot. This deliberately does not reuse Ride,
 * RideUpdatePayload, database identifiers, contact details, or fare fields.
 */
export interface PublicTrackingSnapshot {
  publicReference: string;
  status: RideStatus;
  rideType: RideType;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  driverFirstName: string | null;
  vehicleColour: string | null;
  maskedVehiclePlate: string | null;
  estimatedDurationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTrackingUpdatePayload {
  publicReference: string;
  status: RideStatus;
  updatedAt: string;
}

export interface PublicDriverLocationPayload {
  publicReference: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface Ride {
  id: string;
  passengerId: string;
  driverId?: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  status: RideStatus;
  rideType: RideType;
  estimatedFarePesewas: number;
  actualFarePesewas?: number | null;
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
