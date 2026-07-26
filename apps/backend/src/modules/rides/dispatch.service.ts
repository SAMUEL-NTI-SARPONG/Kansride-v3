import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { REDIS_SERVICE } from '../../redis';
import { IRedisService } from '../../redis/redis.interface';
import { Database, rides, subscriptions } from '@kansride/db';
import { eq, and, gt, inArray, isNull } from 'drizzle-orm';
import type { RideUpdatePayload } from '@kansride/types';
import { EventsGateway } from '../events/events.gateway';
import { RIDE_EVENT_SELECTION, toRideUpdatePayload } from './ride-event.payload';

const DRIVERS_GEO_KEY = 'drivers:online:locations';
const DISPATCH_INITIAL_RADIUS_KM = 2;
const DISPATCH_MAX_RADIUS_KM = 5;
const OFFER_TTL_SECONDS = 30;

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
      await this.offerToDrivers(rideId, nearbyDrivers.slice(0, 5));
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
          await this.offerToDrivers(rideId, expandedDrivers.slice(0, 5));
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
    let offersCreated = 0;
    for (const { member: driverId, distance } of nearbyDrivers) {
      // Check if driver has active subscription
      const activeSubs = await this.db.select().from(subscriptions)
        .where(and(
          eq(subscriptions.driverId, driverId),
          eq(subscriptions.status, 'active'),
          gt(subscriptions.endDate, new Date()),
        ))
        .limit(1);

      if (activeSubs.length === 0) continue;

      // Store offer in Redis with TTL
      const offerKey = `ride:offer:${rideId}:${driverId}`;
      await this.redis.set(offerKey, JSON.stringify({ rideId, driverId, distance, offeredAt: Date.now() }), OFFER_TTL_SECONDS);
      offersCreated += 1;

      this.logger.log(`Ride ${rideId} offered to driver ${driverId} (${distance.toFixed(2)}km away)`);
    }

    if (offersCreated === 0) return;

    // Task 3b owns the driver-targeted ride:offered producer. This task only
    // broadcasts the committed lifecycle state to existing ride subscribers.
    const updated = await this.db
      .update(rides)
      .set({
        status: 'driver_offered',
        updatedAt: new Date(),
      })
      .where(and(eq(rides.id, rideId), eq(rides.status, 'searching')))
      .returning(RIDE_EVENT_SELECTION);
    if (updated[0]) {
      this.emitCommittedUpdate(toRideUpdatePayload(updated[0], 'searching'));
    }
  }

  async driverAcceptRide(
    rideId: string,
    driverId: string,
  ): Promise<
    | { success: true; message: string; update: RideUpdatePayload }
    | { success: false; message: string }
  > {
    // Check if offer exists
    const offerKey = `ride:offer:${rideId}:${driverId}`;
    const offer = await this.redis.get(offerKey);

    if (!offer) {
      return { success: false, message: 'Ride offer expired or does not exist' };
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

  async driverDeclineRide(rideId: string, driverId: string): Promise<void> {
    const offerKey = `ride:offer:${rideId}:${driverId}`;
    await this.redis.del(offerKey);
    this.logger.log(`Driver ${driverId} declined ride ${rideId}`);
  }

  private async cleanupOffers(rideId: string): Promise<void> {
    // In a real implementation, we'd track all offered drivers
    // For now, the TTL will clean them up automatically
    this.logger.debug(`Cleaning up offers for ride ${rideId}`);
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

  // Get pending ride offers for a specific driver
  async getDriverOffers(driverId: string): Promise<string[]> {
    // This would need a secondary index in production
    // For now, return empty — offers are pushed via WebSocket
    return [];
  }
}
