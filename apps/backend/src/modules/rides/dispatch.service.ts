import { Injectable, Inject, Logger } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { REDIS_SERVICE } from '../../redis';
import { IRedisService } from '../../redis/redis.interface';
import { Database, rides, subscriptions } from '@kansride/db';
import { eq, and, gt } from 'drizzle-orm';

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
  ) {}

  async dispatchRide(rideId: string, pickupLongitude: number, pickupLatitude: number): Promise<void> {
    this.logger.log(`Dispatching ride ${rideId} from (${pickupLatitude}, ${pickupLongitude})`);

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
        await this.db.update(rides).set({
          status: 'no_driver_found' as any,
          updatedAt: new Date(),
        }).where(eq(rides.id, rideId));
        // Clean up offers
        await this.cleanupOffers(rideId);
      }
      this.activeDispatches.delete(rideId);
    }, OFFER_TTL_SECONDS * 1000);

    this.activeDispatches.set(rideId, noDriverTimeout);

    // Update ride status to 'searching'
    await this.db.update(rides).set({
      status: 'searching' as any,
      updatedAt: new Date(),
    }).where(eq(rides.id, rideId));
  }

  private async offerToDrivers(rideId: string, nearbyDrivers: Array<{ member: string; distance: number }>): Promise<void> {
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

      this.logger.log(`Ride ${rideId} offered to driver ${driverId} (${distance.toFixed(2)}km away)`);
    }

    // Update ride status to 'driver_offered'
    await this.db.update(rides).set({
      status: 'driver_offered' as any,
      updatedAt: new Date(),
    }).where(eq(rides.id, rideId));
  }

  async driverAcceptRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    // Check if offer exists
    const offerKey = `ride:offer:${rideId}:${driverId}`;
    const offer = await this.redis.get(offerKey);

    if (!offer) {
      return { success: false, message: 'Ride offer expired or does not exist' };
    }

    // Check ride is still in offerable state
    const rideData = await this.db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
    if (!rideData[0] || (rideData[0].status !== 'searching' && rideData[0].status !== 'driver_offered')) {
      return { success: false, message: 'Ride is no longer available' };
    }

    // Assign driver to ride
    await this.db.update(rides).set({
      driverId,
      status: 'driver_assigned' as any,
      updatedAt: new Date(),
    }).where(eq(rides.id, rideId));

    // Clean up all offers for this ride
    await this.cleanupOffers(rideId);

    // Cancel the dispatch timeout
    const timeout = this.activeDispatches.get(rideId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeDispatches.delete(rideId);
    }

    this.logger.log(`Driver ${driverId} accepted ride ${rideId}`);
    return { success: true, message: 'Ride accepted successfully' };
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

  // Get pending ride offers for a specific driver
  async getDriverOffers(driverId: string): Promise<string[]> {
    // This would need a secondary index in production
    // For now, return empty — offers are pushed via WebSocket
    return [];
  }
}
