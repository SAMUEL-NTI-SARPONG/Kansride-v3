import { Injectable, Inject, BadRequestException, ConflictException, NotFoundException, ForbiddenException, Logger, forwardRef } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { MAPS_PROVIDER } from '../../providers';
import { IMapsProvider } from '../../providers/maps/maps.interface';
import { Database, rides, drivers, users, vehicles, passengers } from '@kansride/db';
import { eq, desc, avg, and, isNull, isNotNull } from 'drizzle-orm';
import type { UserRole, RideStatus } from '@kansride/types';
import { FareService } from './fare.service';
import { StateMachineService } from './state-machine.service';
import { DispatchService } from './dispatch.service';
import { EventsGateway } from '../events/events.gateway';

/** Authorization mapping: which roles may cancel a ride. */
const CANCELLATION_ROLES = {
  passenger: { actor: 'passenger', cancelStatus: 'cancelled_by_passenger' as RideStatus },
  driver:    { actor: 'driver',    cancelStatus: 'cancelled_by_driver' as RideStatus },
  super_admin: { actor: 'admin',   cancelStatus: 'cancelled_by_admin' as RideStatus },
} as const satisfies Record<'passenger' | 'driver' | 'super_admin', { actor: string; cancelStatus: RideStatus }>;

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

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
      rideType?: string;
    },
  ) {
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
      data.rideType || 'standard_tricycle',
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
        rideType: data.rideType as any || 'standard_tricycle',
        estimatedFarePesewas: fare.totalFare,
        estimatedDistanceMeters: distance.distanceMeters,
        estimatedDurationSeconds: distance.durationSeconds,
        verificationPin,
      })
      .returning();

    const ride = inserted[0]!;
    this.logger.log(`Ride created: ${ride.id} for passenger ${passenger.id}, fare: ${fare.totalFare} pesewas`);

    // Trigger dispatch engine to find nearby drivers
    this.dispatchService.dispatchRide(ride.id, data.pickupLongitude, data.pickupLatitude).catch((err) => {
      this.logger.error(`Dispatch failed for ride ${ride.id}: ${err.message}`);
    });

    return {
      ...ride,
      fareBreakdown: fare,
    };
  }

  async getRide(id: string) {
    const result = await this.db.select().from(rides).where(eq(rides.id, id)).limit(1);
    if (!result[0]) throw new NotFoundException('Ride not found');
    return result[0];
  }

  async updateStatus(id: string, newStatus: string, actor: string = 'system') {
    const ride = await this.getRide(id);
    this.stateMachine.validateTransition(ride.status, newStatus, actor);

    const updateData: Record<string, unknown> = { status: newStatus, updatedAt: new Date() };
    if (newStatus === 'completed') {
      updateData.completedAt = new Date();
    }

    await this.db
      .update(rides)
      .set(updateData as any)
      .where(eq(rides.id, id));
    this.logger.log(`Ride ${id}: ${ride.status} → ${newStatus} by ${actor}`);

    return { id, previousStatus: ride.status, newStatus };
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

    // The state machine is the single source of truth for transition validity
    // and acts as the duplicate-cancellation guard: terminal states (including
    // all cancelled_* states) have an empty transition array and are rejected
    // here with a precise BadRequestException.
    this.stateMachine.validateTransition(ride.status, cancelStatus, actor);

    const updatedAt = new Date();
    await this.db
      .update(rides)
      .set({
        status: cancelStatus as any,
        cancelledBy,
        cancellationReason: reason,
        updatedAt,
      })
      .where(eq(rides.id, id));

    this.logger.log(`Ride ${id}: ${ride.status} → ${cancelStatus} by ${actor} (user ${cancelledBy})`);

    // Broadcast only after the DB update has committed. The cancelledBy column
    // stores users.id for every actor type (passenger/driver/super_admin) —
    // this is an intentional invariant; no passengers.id/drivers.id resolution
    // is performed and the column remains a free UUID with no FK.
    const payload = {
      rideId: id,
      status: cancelStatus,
      cancelledBy,
      cancelledByRole: role,
      reason,
      cancelledAt: updatedAt.toISOString(),
    };
    this.eventsGateway.emitRideUpdate(id, payload);
    if (ride.driverId) {
      this.eventsGateway.emitToDriver(ride.driverId, 'ride:cancelled', payload);
    }

    return { id, status: cancelStatus, cancelledBy, reason };
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

  async getPassengerRides(passengerId: string, limit = 20) {
    return this.db
      .select()
      .from(rides)
      .where(eq(rides.passengerId, passengerId))
      .orderBy(desc(rides.createdAt))
      .limit(limit);
  }

  async getDriverRides(driverId: string, limit = 20) {
    return this.db
      .select()
      .from(rides)
      .where(eq(rides.driverId, driverId))
      .orderBy(desc(rides.createdAt))
      .limit(limit);
  }

  async getTrackingData(id: string) {
    const result = await this.db.select().from(rides).where(eq(rides.id, id)).limit(1);
    if (!result[0]) throw new NotFoundException('Ride not found');

    const ride = result[0];

    let driverFirstName: string | null = null;
    let vehicleColour: string | null = null;
    let vehiclePlate: string | null = null;

    if (ride.driverId) {
      const driverResult = await this.db
        .select({
          userId: drivers.userId,
          vehicleId: drivers.vehicleId,
        })
        .from(drivers)
        .where(eq(drivers.id, ride.driverId))
        .limit(1);

      const driver = driverResult[0];
      if (driver) {
        // Get driver's first name
        const userResult = await this.db
          .select({ firstName: users.firstName })
          .from(users)
          .where(eq(users.id, driver.userId))
          .limit(1);
        driverFirstName = userResult[0]?.firstName || null;

        // Get vehicle info
        if (driver.vehicleId) {
          const vehicleResult = await this.db
            .select({
              colour: vehicles.colour,
              registrationNumber: vehicles.registrationNumber,
            })
            .from(vehicles)
            .where(eq(vehicles.id, driver.vehicleId))
            .limit(1);

          if (vehicleResult[0]) {
            vehicleColour = vehicleResult[0].colour;
            // Mask plate partially for privacy (show first 3 and last 1)
            const plate = vehicleResult[0].registrationNumber;
            vehiclePlate = plate.length > 4
              ? plate.slice(0, 3) + '***' + plate.slice(-1)
              : plate;
          }
        }
      }
    }

    return {
      id: ride.id,
      status: ride.status,
      pickupLatitude: ride.pickupLatitude,
      pickupLongitude: ride.pickupLongitude,
      pickupAddress: ride.pickupAddress,
      dropoffLatitude: ride.dropoffLatitude,
      dropoffLongitude: ride.dropoffLongitude,
      dropoffAddress: ride.dropoffAddress,
      driverFirstName,
      vehicleColour,
      vehiclePlate,
      estimatedFare: ride.estimatedFarePesewas,
      estimatedDurationSeconds: ride.estimatedDurationSeconds,
      rideType: ride.rideType,
      createdAt: ride.createdAt,
    };
  }
}
