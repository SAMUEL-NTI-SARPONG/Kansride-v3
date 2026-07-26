import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { REDIS_SERVICE } from '../../redis';
import { IRedisService } from '../../redis/redis.interface';
import { Database, drivers, rides, subscriptions, users, vehicles } from '@kansride/db';
import { eq, and, gt, gte, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { RideOfferPayload, RideUpdatePayload } from '@kansride/types';
import { EventsGateway } from '../events/events.gateway';
import { RIDE_EVENT_SELECTION, toRideUpdatePayload } from './ride-event.payload';

const DRIVERS_GEO_KEY = 'drivers:online:locations';
const DISPATCH_INITIAL_RADIUS_KM = 2;
const DISPATCH_MAX_RADIUS_KM = 5;
const OFFER_TTL_SECONDS = 30;
const MAX_OFFERED_DRIVERS = 5;
const DRIVER_LOCATION_MAX_AGE_MS = 60_000;
const ACTIVE_DRIVER_RIDE_STATUSES = [
  'driver_assigned',
  'driver_en_route',
  'driver_arrived',
  'waiting_for_passenger',
  'passenger_verified',
  'in_progress',
  'emergency_hold',
] as const;

interface StoredRideOffer extends RideOfferPayload {
  driverId: string;
}

interface EligibleDriver {
  driverId: string;
  userId: string;
}

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private readonly activeDispatches = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(REDIS_SERVICE) private readonly redis: IRedisService,
    @Inject(forwardRef(() => EventsGateway)) private readonly eventsGateway: EventsGateway,
  ) {}

  async dispatchRide(rideId: string, pickupLongitude: number, pickupLatitude: number): Promise<void> {
    this.logger.log(`Dispatching ride ${rideId} from (${pickupLatitude}, ${pickupLongitude})`);

    // Persist the searchable state before doing any asynchronous dispatch
    // work. The conditional update prevents dispatch from reviving a ride
    // that was cancelled immediately after creation.
    const searchingAt = new Date();
    const searchingRows = await this.db
      .update(rides)
      .set({ status: 'searching', updatedAt: searchingAt })
      .where(and(eq(rides.id, rideId), eq(rides.status, 'requested')))
      .returning(RIDE_EVENT_SELECTION);

    if (!searchingRows[0]) {
      this.logger.warn(`Dispatch skipped for ride ${rideId}: requested state no longer current`);
      return;
    }
    this.emitCommittedUpdate(toRideUpdatePayload(searchingRows[0], 'requested'));

    // First search: initial radius (2km)
    const nearbyDrivers = await this.redis.geoSearch(
      DRIVERS_GEO_KEY,
      pickupLongitude,
      pickupLatitude,
      DISPATCH_INITIAL_RADIUS_KM,
    );

    if (nearbyDrivers.length > 0) {
      await this.offerToDrivers(rideId, nearbyDrivers);
    }

    // Set timeout: expand radius after 15 seconds if no acceptance
    const expandTimeout = setTimeout(async () => {
      const rideData = await this.db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
      if (rideData[0] && rideData[0].status === 'searching') {
        this.logger.log(`Expanding search radius for ride ${rideId} to ${DISPATCH_MAX_RADIUS_KM}km`);
        const expandedDrivers = await this.redis.geoSearch(
          DRIVERS_GEO_KEY,
          pickupLongitude,
          pickupLatitude,
          DISPATCH_MAX_RADIUS_KM,
        );
        if (expandedDrivers.length > 0) {
          await this.offerToDrivers(rideId, expandedDrivers);
        }
      }
    }, 15000);

    // Set timeout: no driver found after 30 seconds total
    const noDriverTimeout = setTimeout(async () => {
      const rideData = await this.db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
      if (rideData[0] && (rideData[0].status === 'searching' || rideData[0].status === 'driver_offered')) {
        this.logger.log(`No driver found for ride ${rideId} after ${OFFER_TTL_SECONDS}s`);
        const updated = await this.db
          .update(rides)
          .set({
            status: 'no_driver_found',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(rides.id, rideId),
              inArray(rides.status, ['searching', 'driver_offered']),
            ),
          )
          .returning(RIDE_EVENT_SELECTION);
        if (updated[0]) {
          this.emitCommittedUpdate(toRideUpdatePayload(updated[0]));
          // Clean up offers only after the terminal dispatch state persisted.
          await this.cleanupOffers(rideId);
        }
      }
      this.activeDispatches.delete(rideId);
    }, OFFER_TTL_SECONDS * 1000);

    this.activeDispatches.set(rideId, noDriverTimeout);
  }

  private async offerToDrivers(rideId: string, nearbyDrivers: Array<{ member: string; distance: number }>): Promise<void> {
    const [ride] = await this.db
      .select({
        id: rides.id,
        status: rides.status,
        rideType: rides.rideType,
        pickupAddress: rides.pickupAddress,
        pickupLandmark: rides.pickupLandmark,
        pickupLatitude: rides.pickupLatitude,
        pickupLongitude: rides.pickupLongitude,
        dropoffAddress: rides.dropoffAddress,
        dropoffLandmark: rides.dropoffLandmark,
        dropoffLatitude: rides.dropoffLatitude,
        dropoffLongitude: rides.dropoffLongitude,
        estimatedFarePesewas: rides.estimatedFarePesewas,
        estimatedDistanceMeters: rides.estimatedDistanceMeters,
        estimatedDurationSeconds: rides.estimatedDurationSeconds,
      })
      .from(rides)
      .where(and(eq(rides.id, rideId), eq(rides.status, 'searching')))
      .limit(1);

    if (!ride) return;

    const orderedNearby = [...nearbyDrivers].sort(
      (left, right) =>
        left.distance - right.distance || left.member.localeCompare(right.member),
    );
    const eligible: Array<EligibleDriver & { distanceKm: number }> = [];
    for (const nearby of orderedNearby) {
      if (await this.redis.get(this.declinedOfferKey(rideId, nearby.member))) {
        continue;
      }
      const driver = await this.getEligibleDriver(nearby.member);
      if (!driver) continue;
      eligible.push({ ...driver, distanceKm: nearby.distance });
      if (eligible.length === MAX_OFFERED_DRIVERS) break;
    }

    if (eligible.length === 0) return;

    const offeredAt = new Date();
    const expiresAt = new Date(offeredAt.getTime() + OFFER_TTL_SECONDS * 1000);
    const offers = eligible.map(({ driverId, userId, distanceKm }) => {
      const payload: RideOfferPayload = {
        rideId: ride.id,
        rideType: ride.rideType,
        pickupAddress: ride.pickupAddress,
        pickupLandmark: ride.pickupLandmark,
        pickupLatitude: Number(ride.pickupLatitude),
        pickupLongitude: Number(ride.pickupLongitude),
        dropoffAddress: ride.dropoffAddress,
        dropoffLandmark: ride.dropoffLandmark,
        dropoffLatitude: Number(ride.dropoffLatitude),
        dropoffLongitude: Number(ride.dropoffLongitude),
        estimatedFarePesewas: ride.estimatedFarePesewas,
        estimatedDistanceMeters: ride.estimatedDistanceMeters,
        estimatedDurationSeconds: ride.estimatedDurationSeconds,
        distanceToPickupMeters: Math.max(0, Math.round(distanceKm * 1000)),
        offeredAt: offeredAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      return { driverId, userId, payload };
    });

    try {
      for (const offer of offers) {
        const stored: StoredRideOffer = {
          ...offer.payload,
          driverId: offer.driverId,
        };
        await this.redis.set(
          this.offerKey(rideId, offer.driverId),
          JSON.stringify(stored),
          OFFER_TTL_SECONDS,
        );
        await this.redis.sAdd(this.rideOfferIndexKey(rideId), offer.driverId);
        await this.redis.sAdd(this.driverOfferIndexKey(offer.driverId), rideId);
      }
    } catch (error) {
      await this.cleanupOffers(rideId);
      throw error;
    }

    // Drivers are notified only after the database confirms driver_offered.
    const updated = await this.db
      .update(rides)
      .set({
        status: 'driver_offered',
        updatedAt: new Date(),
      })
      .where(and(eq(rides.id, rideId), eq(rides.status, 'searching')))
      .returning(RIDE_EVENT_SELECTION);

    if (!updated[0]) {
      await this.cleanupOffers(rideId);
      return;
    }

    this.emitCommittedUpdate(toRideUpdatePayload(updated[0], 'searching'));
    for (const offer of offers) {
      try {
        this.eventsGateway.emitToUser(offer.userId, 'ride:offered', offer.payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Offer for ride ${rideId} persisted for driver ${offer.driverId} but delivery failed: ${message}`,
        );
      }
      this.logger.log(
        `Ride ${rideId} offered to driver ${offer.driverId} (${offer.payload.distanceToPickupMeters}m away)`,
      );
    }
  }

  async driverAcceptRide(
    rideId: string,
    driverId: string,
  ): Promise<
    | { success: true; message: string; update: RideUpdatePayload }
    | { success: false; message: string }
  > {
    const rawOffer = await this.redis.get(this.offerKey(rideId, driverId));
    const offer = this.parseStoredOffer(rawOffer, rideId, driverId);
    if (!offer) {
      await this.removeOffer(rideId, driverId);
      return { success: false, message: 'Ride offer expired or does not exist' };
    }

    if (!(await this.getEligibleDriver(driverId))) {
      await this.removeOffer(rideId, driverId);
      return { success: false, message: 'Driver is no longer eligible for this offer' };
    }

    // Assignment is conditional and atomic: only one concurrent driver can
    // change an unassigned, offerable ride to driver_assigned.
    const assigned = await this.db
      .update(rides)
      .set({
        driverId,
        status: 'driver_assigned',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rides.id, rideId),
          inArray(rides.status, ['searching', 'driver_offered']),
          isNull(rides.driverId),
        ),
      )
      .returning(RIDE_EVENT_SELECTION);

    if (!assigned[0]) {
      await this.removeOffer(rideId, driverId);
      return { success: false, message: 'Ride is no longer available' };
    }

    // Clean up all offers for this ride
    await this.cleanupOffers(rideId);

    // Cancel the dispatch timeout
    const timeout = this.activeDispatches.get(rideId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeDispatches.delete(rideId);
    }

    this.logger.log(`Driver ${driverId} accepted ride ${rideId}`);
    return {
      success: true,
      message: 'Ride accepted successfully',
      update: toRideUpdatePayload(assigned[0]),
    };
  }

  async driverDeclineRide(
    rideId: string,
    driverId: string,
  ): Promise<{ success: boolean; message: string }> {
    const rawOffer = await this.redis.get(this.offerKey(rideId, driverId));
    if (!this.parseStoredOffer(rawOffer, rideId, driverId)) {
      await this.removeOffer(rideId, driverId);
      return { success: false, message: 'Ride offer expired or does not exist' };
    }

    await this.redis.set(
      this.declinedOfferKey(rideId, driverId),
      '1',
      OFFER_TTL_SECONDS,
    );
    await this.removeOffer(rideId, driverId);
    this.logger.log(`Driver ${driverId} declined ride ${rideId}`);
    const remainingDrivers = await this.activeOfferDriverIds(rideId);
    if (remainingDrivers.length === 0) {
      const searching = await this.db
        .update(rides)
        .set({ status: 'searching', updatedAt: new Date() })
        .where(and(eq(rides.id, rideId), eq(rides.status, 'driver_offered')))
        .returning(RIDE_EVENT_SELECTION);
      if (searching[0]) {
        this.emitCommittedUpdate(toRideUpdatePayload(searching[0], 'driver_offered'));
      }
    }
    return { success: true, message: 'Ride offer declined' };
  }

  private async cleanupOffers(rideId: string): Promise<void> {
    const driverIds = await this.redis.sMembers(this.rideOfferIndexKey(rideId));
    for (const driverId of driverIds) {
      await this.removeOffer(rideId, driverId);
    }
    await this.redis.del(this.rideOfferIndexKey(rideId));
    this.logger.debug(`Cleaned ${driverIds.length} offers for ride ${rideId}`);
  }

  async invalidateRideOffers(rideId: string): Promise<void> {
    await this.cleanupOffers(rideId);
    const timeout = this.activeDispatches.get(rideId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeDispatches.delete(rideId);
    }
  }

  private emitCommittedUpdate(payload: RideUpdatePayload): void {
    try {
      this.eventsGateway.emitRideUpdate(payload.rideId, payload);
    } catch (error) {
      // Persistence already succeeded; delivery failure must not make callers
      // believe the database transition rolled back.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Ride ${payload.rideId} was committed but ride:update emission failed: ${message}`,
      );
    }
  }

  async getDriverOffers(driverId: string): Promise<RideOfferPayload[]> {
    const rideIds = (await this.redis.sMembers(this.driverOfferIndexKey(driverId))).sort();
    if (!(await this.getEligibleDriver(driverId))) {
      for (const rideId of rideIds) {
        await this.removeOffer(rideId, driverId);
      }
      return [];
    }

    const offers: RideOfferPayload[] = [];
    for (const rideId of rideIds) {
      const raw = await this.redis.get(this.offerKey(rideId, driverId));
      const stored = this.parseStoredOffer(raw, rideId, driverId);
      if (!stored || !(await this.isOfferRideAvailable(rideId))) {
        await this.removeOffer(rideId, driverId);
        continue;
      }
      const { driverId: _internalDriverId, ...payload } = stored;
      offers.push(payload);
    }
    return offers.sort(
      (left, right) =>
        Date.parse(left.expiresAt) - Date.parse(right.expiresAt)
        || left.rideId.localeCompare(right.rideId),
    );
  }

  private async getEligibleDriver(driverId: string): Promise<EligibleDriver | null> {
    const locationCutoff = new Date(Date.now() - DRIVER_LOCATION_MAX_AGE_MS);
    const [candidate] = await this.db
      .select({
        driverId: drivers.id,
        userId: drivers.userId,
      })
      .from(drivers)
      .innerJoin(users, eq(users.id, drivers.userId))
      .innerJoin(vehicles, eq(vehicles.id, drivers.vehicleId))
      .where(
        and(
          eq(drivers.id, driverId),
          eq(drivers.isActive, true),
          eq(drivers.isOnline, true),
          isNotNull(drivers.currentLatitude),
          isNotNull(drivers.currentLongitude),
          gte(drivers.updatedAt, locationCutoff),
          eq(users.role, 'driver'),
          eq(users.status, 'active'),
          eq(users.isVerified, true),
          eq(vehicles.status, 'active'),
          eq(vehicles.type, 'tricycle'),
        ),
      )
      .limit(1);

    if (!candidate) return null;

    const [subscription] = await this.db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.driverId, driverId),
          eq(subscriptions.status, 'active'),
          gt(subscriptions.endDate, new Date()),
        ),
      )
      .limit(1);
    if (!subscription) return null;

    const [activeRide] = await this.db
      .select({ id: rides.id })
      .from(rides)
      .where(
        and(
          eq(rides.driverId, driverId),
          inArray(rides.status, [...ACTIVE_DRIVER_RIDE_STATUSES]),
        ),
      )
      .limit(1);
    return activeRide ? null : candidate;
  }

  private async isOfferRideAvailable(rideId: string): Promise<boolean> {
    const [ride] = await this.db
      .select({ id: rides.id })
      .from(rides)
      .where(
        and(
          eq(rides.id, rideId),
          inArray(rides.status, ['searching', 'driver_offered']),
          isNull(rides.driverId),
        ),
      )
      .limit(1);
    return Boolean(ride);
  }

  private parseStoredOffer(
    raw: string | null,
    expectedRideId: string,
    expectedDriverId: string,
  ): StoredRideOffer | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredRideOffer>;
      if (
        parsed.rideId !== expectedRideId
        || parsed.driverId !== expectedDriverId
        || typeof parsed.expiresAt !== 'string'
        || !Number.isFinite(Date.parse(parsed.expiresAt))
        || Date.parse(parsed.expiresAt) <= Date.now()
      ) {
        return null;
      }
      return parsed as StoredRideOffer;
    } catch {
      return null;
    }
  }

  private async activeOfferDriverIds(rideId: string): Promise<string[]> {
    const indexed = await this.redis.sMembers(this.rideOfferIndexKey(rideId));
    const active: string[] = [];
    for (const driverId of indexed) {
      const raw = await this.redis.get(this.offerKey(rideId, driverId));
      if (this.parseStoredOffer(raw, rideId, driverId)) {
        active.push(driverId);
      } else {
        await this.removeOffer(rideId, driverId);
      }
    }
    return active.sort();
  }

  private async removeOffer(rideId: string, driverId: string): Promise<void> {
    await this.redis.del(this.offerKey(rideId, driverId));
    await this.redis.sRem(this.rideOfferIndexKey(rideId), driverId);
    await this.redis.sRem(this.driverOfferIndexKey(driverId), rideId);
  }

  private offerKey(rideId: string, driverId: string): string {
    return `ride:offer:${rideId}:${driverId}`;
  }

  private rideOfferIndexKey(rideId: string): string {
    return `ride:offers:${rideId}`;
  }

  private driverOfferIndexKey(driverId: string): string {
    return `driver:offers:${driverId}`;
  }

  private declinedOfferKey(rideId: string, driverId: string): string {
    return `ride:offer-declined:${rideId}:${driverId}`;
  }
}
