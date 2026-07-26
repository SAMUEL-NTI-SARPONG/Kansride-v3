import { rides } from '@kansride/db';
import type { RideStatus, RideUpdatePayload } from '@kansride/types';

export const RIDE_EVENT_SELECTION = {
  id: rides.id,
  status: rides.status,
  driverId: rides.driverId,
  rideType: rides.rideType,
  estimatedFarePesewas: rides.estimatedFarePesewas,
  actualFarePesewas: rides.actualFarePesewas,
  createdAt: rides.createdAt,
  updatedAt: rides.updatedAt,
};

type RideEventRow = Pick<
  typeof rides.$inferSelect,
  | 'id'
  | 'status'
  | 'driverId'
  | 'rideType'
  | 'estimatedFarePesewas'
  | 'actualFarePesewas'
  | 'createdAt'
  | 'updatedAt'
>;

export function toRideUpdatePayload(
  ride: RideEventRow,
  previousStatus?: RideStatus,
  cancellation?: Pick<
    RideUpdatePayload,
    | 'cancelledBy'
    | 'cancelledByRole'
    | 'cancellationReason'
    | 'reason'
    | 'cancelledAt'
  >,
): RideUpdatePayload {
  return {
    rideId: ride.id,
    status: ride.status,
    ...(previousStatus === undefined ? {} : { previousStatus }),
    driverId: ride.driverId,
    rideType: ride.rideType,
    estimatedFarePesewas: ride.estimatedFarePesewas,
    actualFarePesewas: ride.actualFarePesewas,
    createdAt: ride.createdAt.toISOString(),
    updatedAt: ride.updatedAt.toISOString(),
    ...cancellation,
  };
}
