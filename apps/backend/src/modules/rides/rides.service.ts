import { Injectable, Inject, BadRequestException, ConflictException, NotFoundException, ForbiddenException, Logger, forwardRef } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { MAPS_PROVIDER } from '../../providers';
import { IMapsProvider } from '../../providers/maps/maps.interface';
import { Database, rides, drivers, passengers } from '@kansride/db';
import { RBACService } from '@kansride/auth';
import { eq, desc, avg, and, isNull, isNotNull, type SQL } from 'drizzle-orm';
import type {
  CreateRideResponse,
  UserRole,
  RideStatus,
  RideType,
} from '@kansride/types';
import { FareService } from './fare.service';
import { StateMachineService } from './state-machine.service';
import { DispatchService } from './dispatch.service';
import { EventsGateway } from '../events/events.gateway';
import { RIDE_EVENT_SELECTION, toRideUpdatePayload } from './ride-event.payload';

/** Authorization mapping: which roles may cancel a ride. */
const CANCELLATION_ROLES = {
  passenger: { actor: 'passenger', cancelStatus: 'cancelled_by_passenger' as RideStatus },
  driver:    { actor: 'driver',    cancelStatus: 'cancelled_by_driver' as RideStatus },
  ops_admin: { actor: 'admin',   cancelStatus: 'cancelled_by_admin' as RideStatus },
  system_admin: { actor: 'admin',   cancelStatus: 'cancelled_by_admin' as RideStatus },
  super_admin: { actor: 'admin',   cancelStatus: 'cancelled_by_admin' as RideStatus },
} as const satisfies Record<'passenger' | 'driver' | 'ops_admin' | 'system_admin' | 'super_admin', { actor: string; cancelStatus: RideStatus }>;

const STATUS_UPDATE_ROLES: Partial<Record<UserRole, string>> = {
  driver: 'driver',
  super_admin: 'admin',
};

const ALLOWED_RIDE_TYPES = [
  'standard_tricycle',
  'priority_tricycle',
  'shared',
  'parcel_delivery',
] as const satisfies readonly RideType[];

function isRideType(value: unknown): value is RideType {
  return typeof value === 'string'
    && ALLOWED_RIDE_TYPES.some((rideType) => rideType === value);
}

function resolveRideType(value: unknown): RideType {
  if (value === undefined) return 'standard_tricycle';

  if (!isRideType(value)) {
    throw new BadRequestException(
      `rideType must be one of: ${ALLOWED_RIDE_TYPES.join(', ')}`,
    );
  }

  return value;
}

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);
  // Used to resolve whether an arbitrary staff role carries the ride:view_all
  // permission, so getRideForActor can admit dispatcher/support/safety/audit/
  // ops/system-admin staff who pass the controller's @RequirePermissions guard
  // but were previously rejected by the terminal forbidden-branch below.
  private readonly rbacService = new RBACService();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(MAPS_PROVIDER) private readonly mapsProvider: IMapsProvider,
    private readonly fareService: FareService,
    private readonly stateMachine: StateMachineService,
    private readonly dispatchService: DispatchService,
    @Inject(forwardRef(() => EventsGateway)) private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Resolves the passenger profile row for an authenticated user.
   *
   * The JWT carries `userId` = `users.id`, but `rides.passengerId` is a
   * foreign key to `passengers.id`. This helper translates between the two
   * identifiers. It does NOT create a passenger row (that is owned by the
   * auth flow, Task 1a); it only reads the existing profile and refuses
   * with a ForbiddenException when the authenticated user has none (e.g. a
   * driver/admin/dispatcher role account) or when a pre-existing passenger
   * user never received a profile for any reason.
   */
  private async getPassengerProfileByUserId(authenticatedUserId: string) {
    const rows = await this.db
      .select()
      .from(passengers)
      .where(eq(passengers.userId, authenticatedUserId))
      .limit(1);
    const passenger = rows[0];
    if (!passenger) {
      throw new ForbiddenException('No passenger profile found for this account');
    }
    return passenger;
  }

  /**
   * Resolve drivers.id from the users.id carried by the JWT. Ride ownership
   * must always be checked against this profile id, never the authenticated
   * users.id directly.
   */
  private async getDriverProfileByUserId(authenticatedUserId: string) {
    const rows = await this.db
      .select()
      .from(drivers)
      .where(eq(drivers.userId, authenticatedUserId))
      .limit(1);
    const driver = rows[0];
    if (!driver) {
      throw new NotFoundException('No driver profile found for this account');
    }
    return driver;
  }

  async createRide(
    authenticatedUserId: string,
    data: {
      pickupLatitude: number;
      pickupLongitude: number;
      pickupAddress?: string;
      pickupLandmark?: string;
      dropoffLatitude: number;
      dropoffLongitude: number;
      dropoffAddress?: string;
      dropoffLandmark?: string;
      rideType?: RideType;
    },
  ): Promise<CreateRideResponse> {
    const rideType = resolveRideType(data.rideType);

    // Resolve the real passenger.id from the authenticated users.id.
    // Never insert users.id into rides.passengerId (FK -> passengers.id).
    const passenger = await this.getPassengerProfileByUserId(authenticatedUserId);

    // Get distance estimate from maps provider
    const distance = await this.mapsProvider.getDistance(
      { latitude: data.pickupLatitude, longitude: data.pickupLongitude },
      { latitude: data.dropoffLatitude, longitude: data.dropoffLongitude },
    );

    // Calculate fare
    const fare = this.fareService.calculateFare(
      distance.distanceMeters,
      distance.durationSeconds,
      rideType,
    );

    // Generate 4-digit verification PIN
    const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();

    // Insert ride
    const inserted = await this.db
      .insert(rides)
      .values({
        passengerId: passenger.id,
        pickupLatitude: data.pickupLatitude.toString(),
        pickupLongitude: data.pickupLongitude.toString(),
        pickupAddress: data.pickupAddress,
        pickupLandmark: data.pickupLandmark,
        dropoffLatitude: data.dropoffLatitude.toString(),
        dropoffLongitude: data.dropoffLongitude.toString(),
        dropoffAddress: data.dropoffAddress,
        dropoffLandmark: data.dropoffLandmark,
        status: 'requested',
        rideType,
        estimatedFarePesewas: fare.totalFarePesewas,
        estimatedDistanceMeters: distance.distanceMeters,
        estimatedDurationSeconds: distance.durationSeconds,
        verificationPin,
      })
      .returning();

    const ride = inserted[0]!;
    this.logger.log(
      `Ride created: ${ride.id} for passenger ${passenger.id}, fare: ${fare.totalFarePesewas} pesewas`,
    );

    // The insert has resolved, so the requested state is committed. A newly
    // created ride has no room subscribers yet; target the authenticated
    // passenger's sockets directly.
    this.emitRideUpdateToUser(authenticatedUserId, toRideUpdatePayload(ride));

    // Trigger dispatch engine to find nearby drivers
    this.dispatchService.dispatchRide(ride.id, data.pickupLongitude, data.pickupLatitude).catch((err) => {
      this.logger.error(`Dispatch failed for ride ${ride.id}: ${err.message}`);
    });

    return {
      ...ride,
      verificationPin,
      fareBreakdown: fare,
    };
  }

  async getRide(id: string) {
    const result = await this.db.select().from(rides).where(eq(rides.id, id)).limit(1);
    if (!result[0]) throw new NotFoundException('Ride not found');
    return result[0];
  }

  async getRideForActor(id: string, authenticatedUserId: string, role: UserRole) {
    const ride = await this.getRide(id);

    if (role === 'passenger') {
      const passenger = await this.getPassengerProfileByUserId(authenticatedUserId);
      if (ride.passengerId !== passenger.id) {
        throw new ForbiddenException('You can only view your own rides');
      }
      return ride;
    }

    if (role === 'driver') {
      const driver = await this.getDriverProfileByUserId(authenticatedUserId);
      if (ride.driverId !== driver.id) {
        throw new ForbiddenException('You can only view rides assigned to you');
      }
      // The passenger reads this PIN aloud at pickup. Returning it to the
      // assigned driver would make the verification step meaningless.
      const { verificationPin: _verificationPin, ...driverSafeRide } = ride;
      return driverSafeRide;
    }

if (role === 'super_admin') {
      return ride;
    }

    // Staff roles carrying ride:view_all (dispatcher, support_agent,
    // safety_officer, finance_officer does NOT carry it, ops_admin,
    // system_admin, auditor) may view any single ride. The controller's
    // @RequirePermissions('ride:view') gate was previously the only check, so
    // these roles could list rides via /admin/rides but were forbidden from
    // `GET /rides/:id`, breaking the admin dashboard's row drill-down. The
    // verification PIN is stripped for non-super_admin staff: the PIN is the
    // passenger/driver pickup handshake and is not needed for staff ride
    // review, matching the driver-branch protection above.
    if (this.rbacService.hasPermission(role, 'ride:view_all')) {
      const { verificationPin: _verificationPin, ...staffSafeRide } = ride;
      return staffSafeRide;
    }

    throw new ForbiddenException(`Role "${role}" is not permitted to view this ride`);
  }

  async updateStatus(
    id: string,
    newStatus: string,
    authenticatedUserId: string,
    role: UserRole,
  ) {
    const ride = await this.getRide(id);

    const actor = STATUS_UPDATE_ROLES[role];
    if (!actor) {
      throw new ForbiddenException(`Role "${role}" is not permitted to update ride status`);
    }
    if (role === 'driver') {
      const driver = await this.getDriverProfileByUserId(authenticatedUserId);
      if (ride.driverId !== driver.id) {
        throw new ForbiddenException('You can only update rides assigned to you');
      }
    }
    if (newStatus === 'passenger_verified') {
      throw new BadRequestException(
        'Use the passenger PIN verification endpoint for this transition',
      );
    }

    this.stateMachine.validateTransition(ride.status, newStatus, actor);

    const updatedAt = new Date();
    const updateData: Record<string, unknown> = { status: newStatus, updatedAt };
    if (newStatus === 'completed') {
      updateData.completedAt = updatedAt;
      updateData.actualFarePesewas =
        ride.actualFarePesewas ?? ride.estimatedFarePesewas;
    }

    const updated = await this.db
      .update(rides)
      .set(updateData as any)
      .where(and(eq(rides.id, id), eq(rides.status, ride.status)))
      .returning(RIDE_EVENT_SELECTION);

    if (!updated[0]) {
      throw new ConflictException('Ride status changed before this update could be applied');
    }

    this.logger.log(`Ride ${id}: ${ride.status} → ${newStatus} by ${actor}`);
    this.emitRideUpdate(id, toRideUpdatePayload(updated[0], ride.status));

    return { id, previousStatus: ride.status, newStatus };
  }

  async verifyPassenger(
    id: string,
    verificationPin: string,
    authenticatedUserId: string,
    role: UserRole,
  ) {
    if (role !== 'driver') {
      throw new ForbiddenException('Only the assigned driver may verify the passenger');
    }
    if (!/^\d{4}$/.test(verificationPin)) {
      throw new BadRequestException('Verification PIN must contain exactly 4 digits');
    }

    const ride = await this.getRide(id);
    const driver = await this.getDriverProfileByUserId(authenticatedUserId);
    if (ride.driverId !== driver.id) {
      throw new ForbiddenException('You can only verify passengers for rides assigned to you');
    }
    if (ride.status !== 'waiting_for_passenger') {
      throw new BadRequestException(
        'Passenger verification is only available while waiting for the passenger',
      );
    }
    if (ride.verificationPin !== verificationPin) {
      throw new BadRequestException('Invalid passenger verification PIN');
    }

    const updated = await this.db
      .update(rides)
      .set({ status: 'passenger_verified', updatedAt: new Date() })
      .where(and(eq(rides.id, id), eq(rides.status, 'waiting_for_passenger')))
      .returning(RIDE_EVENT_SELECTION);
    if (!updated[0]) {
      throw new ConflictException('Ride status changed before verification completed');
    }

    this.emitRideUpdate(
      id,
      toRideUpdatePayload(updated[0], 'waiting_for_passenger'),
    );
    return {
      id,
      previousStatus: 'waiting_for_passenger',
      newStatus: 'passenger_verified',
    };
  }

  async cancelRide(id: string, cancelledBy: string, role: UserRole, reason?: string) {
    const ride = await this.getRide(id);

    // Resolve state-machine actor and target status from the authenticated role.
    // Only the explicitly-mapped roles below may cancel; anything else is an
    // authorization failure (the @RequirePermissions('ride:cancel') guard on
    // the controller has already filtered for possession of the permission,
    // but the role→actor map is the authoritative list of supported callers).
    const mapping = CANCELLATION_ROLES[role as keyof typeof CANCELLATION_ROLES];
    if (!mapping) {
      throw new ForbiddenException(`Role "${role}" is not permitted to cancel rides`);
    }
    const { actor, cancelStatus } = mapping;

    // Authorization is profile-scoped. The JWT contains users.id while the
    // ride stores passengers.id/drivers.id, so resolve before ownership checks.
    if (role === 'passenger') {
      const passenger = await this.getPassengerProfileByUserId(cancelledBy);
      if (ride.passengerId !== passenger.id) {
        throw new ForbiddenException('You can only cancel your own rides');
      }
    } else if (role === 'driver') {
      const driver = await this.getDriverProfileByUserId(cancelledBy);
      if (ride.driverId !== driver.id) {
        throw new ForbiddenException('You can only cancel rides assigned to you');
      }
    }

    // The state machine is the single source of truth for transition validity
    // and acts as the duplicate-cancellation guard: terminal states (including
    // all cancelled_* states) have an empty transition array and are rejected
    // here with a precise BadRequestException.
    this.stateMachine.validateTransition(ride.status, cancelStatus, actor);

    const updatedAt = new Date();
    const updated = await this.db
      .update(rides)
      .set({
        status: cancelStatus as any,
        cancelledBy,
        cancellationReason: reason,
        updatedAt,
      })
      .where(and(eq(rides.id, id), eq(rides.status, ride.status)))
      .returning(RIDE_EVENT_SELECTION);

    if (!updated[0]) {
      throw new ConflictException('Ride status changed before cancellation could be applied');
    }

    this.logger.log(`Ride ${id}: ${ride.status} → ${cancelStatus} by ${actor} (user ${cancelledBy})`);

    try {
      await this.dispatchService.invalidateRideOffers(id);
    } catch (error) {
      this.logger.error(
        `Ride ${id} was cancelled but offer cleanup failed: ${this.errorMessage(error)}`,
      );
    }

    // Broadcast only after the DB update has committed. The cancelledBy column
    // stores users.id for every actor type (passenger/driver/super_admin) —
    // this is an intentional invariant; no passengers.id/drivers.id resolution
    // is performed and the column remains a free UUID with no FK.
    const payload = toRideUpdatePayload(updated[0], ride.status, {
      cancelledBy,
      cancelledByRole: role,
      cancellationReason: reason ?? null,
      ...(reason === undefined ? {} : { reason }),
      cancelledAt: updatedAt.toISOString(),
    });
    this.emitRideUpdate(id, payload);
    if (ride.driverId) {
      void this.eventsGateway
        .emitToDriver(ride.driverId, 'ride:cancelled', payload)
        .catch((error: unknown) => {
          this.logger.error(
            `Ride ${id} was cancelled but direct driver notification failed: ${this.errorMessage(error)}`,
          );
        });
    }

    return { id, status: cancelStatus, cancelledBy, reason };
  }

  private emitRideUpdate(rideId: string, payload: ReturnType<typeof toRideUpdatePayload>): void {
    try {
      this.eventsGateway.emitRideUpdate(rideId, payload);
    } catch (error) {
      // The database transition is already committed. Do not turn a socket
      // delivery failure into a false HTTP mutation failure.
      this.logger.error(
        `Ride ${rideId} was committed but ride:update emission failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private emitRideUpdateToUser(
    userId: string,
    payload: ReturnType<typeof toRideUpdatePayload>,
  ): void {
    try {
      this.eventsGateway.emitToUser(userId, 'ride:update', payload);
    } catch (error) {
      this.logger.error(
        `Ride ${payload.rideId} was committed but passenger notification failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async rateRide(id: string, authenticatedUserId: string, role: UserRole, rating: number, comment?: string) {
    // D4: Integer ratings only, 1..5. Reject fractional values up-front so we
    // never persist a non-integer into the integer column (which would error
    // at the DB layer with an opaque message).
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be an integer between 1 and 5');
    }

    const ride = await this.getRide(id);

    // Only completed rides may be rated (in_progress / cancelled / draft, etc. are rejected).
    if (ride.status !== 'completed') {
      throw new BadRequestException('Can only rate completed rides');
    }

    // Defense-in-depth: RBAC already restricts the route to roles carrying
    // 'ride:rate', but only the passenger who owns the ride may rate it.
    if (role !== 'passenger') {
      throw new ForbiddenException('Only passengers may rate rides');
    }

    // Resolve passengers.id from the authenticated users.id.
    const passenger = await this.getPassengerProfileByUserId(authenticatedUserId);
    if (ride.passengerId !== passenger.id) {
      throw new ForbiddenException('You can only rate your own rides');
    }

    // Friendly duplicate-rating pre-check: if ratedBy is already set, refuse
    // fast without entering the transaction. This is purely an optimization
    // (the authoritative guard is the conditional UPDATE below); it remains
    // correct because ratedBy is set once and never cleared.
    if (ride.ratedBy !== null) {
      throw new ConflictException('This ride has already been rated');
    }

    // Persistence + driver-aggregate recomputation execute in a single
    // transaction so that a failure of either rolls back both. The conditional
    // UPDATE (WHERE rated_by IS NULL) is the authoritative concurrent-duplicate
    // guard: two concurrent requests cannot both commit row mutations — one
    // will observe zero rows updated and we throw ConflictException.
    const ratedAt = new Date();
    const driverIdForLog: string | null = ride.driverId;

    await this.db.transaction(async (tx) => {
      // Conditional UPDATE: only mutates the row if no one has rated it yet.
      // .returning() lets us distinguish "0 rows updated" (concurrent loser)
      // from "1 row updated" (winner) without a second round-trip.
      const updated = await tx
        .update(rides)
        .set({
          rating,
          ratingComment: comment,
          ratedAt,
          ratedBy: authenticatedUserId,
          updatedAt: ratedAt,
        })
        .where(and(eq(rides.id, id), isNull(rides.ratedBy)))
        .returning({ id: rides.id });

      if (updated.length === 0) {
        // Zero rows updated means another request won the race between our
        // pre-check and this UPDATE. The ride now has a rating; throw inside
        // the transaction so Postgres rolls back the (no-op) UPDATE and
        // Nest's exception filter surfaces the 409 to the client.
        throw new ConflictException('This ride has already been rated');
      }

      // D2: Recompute the driver's aggregate rating as a live AVG() over
      // every rated ride for that driver. We do not maintain
      // drivers.completedRides (it is unmaintained per inspection) and we do
      // not run a running-average algorithm — the database re-aggregates
      // from the persisted per-ride ratings on every submission, using the
      // transaction-scoped view that already reflects our UPDATE above.
      // drivers.rating is numeric(3,2); the column accepts string input.
      if (driverIdForLog) {
        const [avgRow] = await tx
          .select({ value: avg(rides.rating) })
          .from(rides)
          .where(and(eq(rides.driverId, driverIdForLog), isNotNull(rides.rating)));
        const avgString = avgRow?.value;
        if (typeof avgString === 'string' && avgString.length > 0) {
          const parsed = parseFloat(avgString);
          // parseFloat returns NaN for unparseable strings; Number.isFinite
          // also rejects Infinity. We guard so we never write NaN/Infinity
          // to a numeric(3,2) column (Postgres would reject, but the error
          // would be opaque). Given the just-applied integer rating, this
          // is a defensive check, not an expected path.
          if (Number.isFinite(parsed)) {
            // Format with exactly 2 decimal places to match numeric(3,2)
            // representation (e.g. "5.00", "4.50", "3.33"). toFixed rounds
            // half-away-from-zero which matches Postgres numeric behavior.
            const driverRatingValue = parsed.toFixed(2);
            await tx
              .update(drivers)
              .set({ rating: driverRatingValue })
              .where(eq(drivers.id, driverIdForLog));
            this.logger.log(`Driver ${driverIdForLog} rating recomputed to ${driverRatingValue}`);
          } else {
            this.logger.warn(`AVG(rides.rating) returned non-numeric value for driver ${driverIdForLog}: ${JSON.stringify(avgString)}`);
          }
        } else {
          // avg() returns NULL only if every rides.rating for this driver
          // is NULL — impossible right after our conditional UPDATE set one.
          // This branch is unreachable in practice; log defensively.
          this.logger.warn(`AVG(rides.rating) returned null/empty for driver ${driverIdForLog} (unexpected after rating)`);
        }
      }
    });

    this.logger.log(`Ride ${id} rated ${rating}/5 by passenger ${passenger.id} (user ${authenticatedUserId})`);

    return { id, rating, comment };
  }

  async getRideHistory(
    authenticatedUserId: string,
    role: UserRole,
    pagination: { limit: number; offset: number },
  ) {
    if (role === 'passenger') {
      const passenger = await this.getPassengerProfileByUserId(authenticatedUserId);
      return this.getRideHistoryForOwner(
        eq(rides.passengerId, passenger.id),
        pagination,
      );
    }

    if (role === 'driver') {
      const driver = await this.getDriverProfileByUserId(authenticatedUserId);
      return this.getRideHistoryForOwner(
        eq(rides.driverId, driver.id),
        pagination,
      );
    }

    throw new ForbiddenException(`Role "${role}" is not permitted to view personal ride history`);
  }

  private async getRideHistoryForOwner(
    ownerFilter: SQL<unknown>,
    pagination: { limit: number; offset: number },
  ) {
    const history = await this.db
      .select({
        id: rides.id,
        pickupAddress: rides.pickupAddress,
        dropoffAddress: rides.dropoffAddress,
        pickupLatitude: rides.pickupLatitude,
        pickupLongitude: rides.pickupLongitude,
        dropoffLatitude: rides.dropoffLatitude,
        dropoffLongitude: rides.dropoffLongitude,
        actualFarePesewas: rides.actualFarePesewas,
        estimatedFarePesewas: rides.estimatedFarePesewas,
        status: rides.status,
        createdAt: rides.createdAt,
        rideType: rides.rideType,
      })
      .from(rides)
      .where(ownerFilter)
      .orderBy(desc(rides.createdAt), desc(rides.id))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return history.map((ride) => ({
      id: ride.id,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      pickupLatitude: Number(ride.pickupLatitude),
      pickupLongitude: Number(ride.pickupLongitude),
      dropoffLatitude: Number(ride.dropoffLatitude),
      dropoffLongitude: Number(ride.dropoffLongitude),
      farePesewas: ride.actualFarePesewas ?? ride.estimatedFarePesewas,
      status: ride.status,
      createdAt: ride.createdAt,
      rideType: ride.rideType,
    }));
  }

}
