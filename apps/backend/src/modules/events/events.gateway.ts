import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JWTService, RBACService } from '@kansride/auth';
import { DATABASE_TOKEN } from '../../database';
import { REDIS_SERVICE } from '../../redis';
import { IRedisService } from '../../redis/redis.interface';
import { Database, rides, drivers, passengers } from '@kansride/db';
import { eq, and, inArray } from 'drizzle-orm';
import { isUUID } from 'class-validator';
import { DispatchService } from '../rides/dispatch.service';
import type { RideAcceptResult, RideUpdatePayload } from '@kansride/types';
import { PublicTrackingGateway } from './public-tracking.gateway';
import { ACTIVE_RIDE_LOCATION_STATUSES, getEnv } from '@kansride/config';

type DriverLocationInput = { latitude: number; longitude: number };

const DRIVERS_GEO_KEY = 'drivers:online:locations';
const LOCATION_DB_DEBOUNCE_MS = 5000;

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    role: string;
    phoneNumber: string;
  };
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/rides' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly jwtService: JWTService;
  private readonly rbacService = new RBACService();

  /** Map of userId → Set of socket IDs */
  private readonly connectedUsers = new Map<string, Set<string>>();

  /** Map of driverId → last DB update timestamp (for debouncing) */
  private readonly lastDbUpdate = new Map<string, number>();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(REDIS_SERVICE) private readonly redis: IRedisService,
    @Inject(forwardRef(() => DispatchService)) private readonly dispatchService: DispatchService,
    private readonly publicTrackingGateway: PublicTrackingGateway,
  ) {
    const env = getEnv();
    this.jwtService = new JWTService({
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpiry: '15m',
      refreshExpiry: '7d',
    });
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Connection rejected: no token (socket ${client.id})`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verifyAccessToken(token);

      // Store user info on socket
      client.data.userId = payload.userId;
      client.data.role = payload.role;
      client.data.phoneNumber = payload.phoneNumber;

      // Track connected user
      const userSockets = this.connectedUsers.get(payload.userId) || new Set();
      userSockets.add(client.id);
      this.connectedUsers.set(payload.userId, userSockets);

      this.logger.log(
        `Client connected: ${client.id} (user: ${payload.userId}, role: ${payload.role})`,
      );
    } catch (error) {
      this.logger.warn(`Connection rejected: invalid token (socket ${client.id})`);
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data?.userId;
    if (userId) {
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
        }
      }
    }
    this.logger.log(`Client disconnected: ${client.id} (user: ${userId || 'unknown'})`);
  }

  @SubscribeMessage('driver:location')
  async handleDriverLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: DriverLocationInput,
  ) {
    const userId = client.data?.userId;
    if (!userId) {
      return { event: 'error', data: { message: 'Not authenticated' } };
    }
    if (client.data.role !== 'driver') {
      return { event: 'error', data: { message: 'Driver role required' } };
    }

    // Find driver record by userId
    const driverRecords = await this.db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.userId, userId))
      .limit(1);

    const driverRecord = driverRecords[0];
    if (!driverRecord) {
      return { event: 'error', data: { message: 'Driver profile not found' } };
    }

    const driverId = driverRecord.id;
    if (!this.isValidCoordinate(data)) {
      return { event: 'error', data: { message: 'Valid latitude and longitude are required' } };
    }

    const eligibleForActiveRide = await this.dispatchService.isDriverLocationEligible(driverId, true, false);
    if (!eligibleForActiveRide) {
      await this.redis.geoRemove(DRIVERS_GEO_KEY, driverId);
      return { event: 'error', data: { message: 'Driver is not eligible for live location' } };
    }

    // Persist the current fix before re-evaluating freshness. A stale but
    // otherwise eligible online driver may refresh its availability with this
    // validated location; all future dispatch queries still use the 60-second
    // freshness cutoff.
    const now = Date.now();
    const lastUpdate = this.lastDbUpdate.get(driverId) || 0;
    if (now - lastUpdate >= LOCATION_DB_DEBOUNCE_MS) {
      this.lastDbUpdate.set(driverId, now);
      await this.db
        .update(drivers)
        .set({
          currentLatitude: data.latitude.toString(),
          currentLongitude: data.longitude.toString(),
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, driverId));
    }

    const eligibleForAvailability = await this.dispatchService.isDriverLocationEligible(driverId, false, true);
    if (eligibleForAvailability) {
      await this.redis.geoAdd(DRIVERS_GEO_KEY, data.longitude, data.latitude, driverId);
    } else {
      await this.redis.geoRemove(DRIVERS_GEO_KEY, driverId);
    }

    // Check if driver has an active ride — broadcast location to ride room
    const activeRides = await this.db
      .select({ id: rides.id })
      .from(rides)
      .where(
        and(eq(rides.driverId, driverId), inArray(rides.status, [...ACTIVE_RIDE_LOCATION_STATUSES])),
      )
      .limit(1);

    if (activeRides[0]) {
      this.server.to(`ride:${activeRides[0].id}`).emit('ride:driver-location', {
        rideId: activeRides[0].id,
        driverId,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: now,
      });
      void this.publicTrackingGateway
        .emitDriverLocation(
          activeRides[0].id,
          data.latitude,
          data.longitude,
          new Date(now),
        )
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Public location delivery failed for ride ${activeRides[0]!.id}: ${message}`,
          );
        });
    }

    return { event: 'ack', data: { received: true } };
  }

  @SubscribeMessage('driver:accept-ride')
  async handleDriverAcceptRide(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { rideId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId) {
      return { event: 'error', data: { message: 'Not authenticated' } };
    }
    if (client.data.role !== 'driver') {
      return { event: 'error', data: { message: 'Driver role required' } };
    }
    if (!this.isValidRideId(data?.rideId)) {
      return { event: 'error', data: { message: 'Invalid ride request' } };
    }

    // Find driver record by userId
    const driverRecords = await this.db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.userId, userId))
      .limit(1);

    const driverRecord = driverRecords[0];
    if (!driverRecord) {
      client.emit('error', { message: 'Driver profile not found' });
      return;
    }

    const driverId = driverRecord.id;

    const result = await this.dispatchService.driverAcceptRide(data.rideId, driverId);

    if (result.success) {
      // The conditional database update has resolved. Join the accepting
      // driver's socket before the single canonical room broadcast so both
      // the passenger and assigned driver observe driver_assigned.
      try {
        await client.join(`ride:${data.rideId}`);
        this.emitRideUpdate(data.rideId, result.update);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Ride ${data.rideId} was assigned but realtime delivery failed: ${message}`,
        );
      }
      const acceptResult: RideAcceptResult = {
        rideId: data.rideId,
        success: true,
        message: result.message,
      };
      client.emit('ride:accept-result', acceptResult);
      return { event: 'ack', data: { success: true, message: result.message } };
    } else {
      const acceptResult: RideAcceptResult = {
        rideId: data.rideId,
        success: false,
        message: result.message,
      };
      client.emit('ride:accept-result', acceptResult);
      client.emit('error', { message: result.message });
      return { event: 'error', data: { success: false, message: result.message } };
    }
  }

  @SubscribeMessage('driver:decline-ride')
  async handleDriverDeclineRide(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { rideId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId) {
      return { event: 'error', data: { message: 'Not authenticated' } };
    }
    if (client.data.role !== 'driver') {
      return { event: 'error', data: { message: 'Driver role required' } };
    }
    if (!this.isValidRideId(data?.rideId)) {
      return { event: 'error', data: { message: 'Invalid ride request' } };
    }

    // Find driver record by userId
    const driverRecords = await this.db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.userId, userId))
      .limit(1);

    const driverRecord = driverRecords[0];
    if (!driverRecord) {
      return { event: 'error', data: { message: 'Driver profile not found' } };
    }

    const result = await this.dispatchService.driverDeclineRide(
      data.rideId,
      driverRecord.id,
    );
    return { event: result.success ? 'ack' : 'error', data: result };
  }

  @SubscribeMessage('driver:get-offers')
  async handleDriverGetOffers(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.data?.userId;
    if (!userId || client.data.role !== 'driver') {
      return { event: 'error', data: { message: 'Driver role required' } };
    }

    const [driver] = await this.db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.userId, userId))
      .limit(1);
    if (!driver) {
      return { event: 'error', data: { message: 'Driver profile not found' } };
    }

    const offers = await this.dispatchService.getDriverOffers(driver.id);
    for (const offer of offers) {
      client.emit('ride:offered', offer);
    }
    return { event: 'ack', data: { offers: offers.length } };
  }

  @SubscribeMessage('ride:subscribe')
  async handleRideSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { rideId: string },
  ) {
    if (!client.data?.userId) {
      return { event: 'error', data: { message: 'Not authenticated' } };
    }
    if (!this.isValidRideId(data?.rideId)) {
      return { event: 'error', data: { message: 'Invalid ride subscription' } };
    }
    if (!(await this.canJoinPrivateRide(client, data.rideId))) {
      return { event: 'error', data: { message: 'Ride subscription not authorized' } };
    }

    await client.join(`ride:${data.rideId}`);
    this.logger.debug(`User ${client.data.userId} subscribed to ride:${data.rideId}`);
    return { event: 'ack', data: { subscribed: data.rideId } };
  }

  @SubscribeMessage('ride:unsubscribe')
  async handleRideUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { rideId: string },
  ) {
    if (!client.data?.userId || !this.isValidRideId(data?.rideId)) {
      return { event: 'error', data: { message: 'Invalid ride subscription' } };
    }
    await client.leave(`ride:${data.rideId}`);
    return { event: 'ack', data: { unsubscribed: data.rideId } };
  }

  @SubscribeMessage('admin:subscribe')
  async handleAdminSubscribe(@ConnectedSocket() client: AuthenticatedSocket) {
    const permitted = this.rbacService.hasAnyPermission(client.data?.role, [
      'ride:view_all',
      'dispatch:view_live_map',
      'safety:view_live_trips',
    ]);
    if (!client.data?.userId || !permitted) {
      return { event: 'error', data: { message: 'Admin subscription not authorized' } };
    }
    await client.join('admin:rides');
    return { event: 'ack', data: { subscribed: 'admin:rides' } };
  }

  @SubscribeMessage('admin:unsubscribe')
  async handleAdminUnsubscribe(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.data?.userId) {
      return { event: 'error', data: { message: 'Not authenticated' } };
    }
    await client.leave('admin:rides');
    return { event: 'ack', data: { unsubscribed: 'admin:rides' } };
  }

  // ─── Public Methods for Other Services ──────────────────────────────────────

  /** Broadcast a ride update to all sockets in the ride room */
  emitRideUpdate(rideId: string, data: RideUpdatePayload) {
    this.server.to(`ride:${rideId}`).emit('ride:update', data);
    void this.publicTrackingGateway.emitRideUpdate(data).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Public tracking delivery failed for ride ${rideId}: ${message}`);
    });
  }

  /** Send an event to all connected sockets of a specific user */
  emitToUser(userId: string, event: string, data: unknown) {
    const socketIds = this.connectedUsers.get(userId);
    if (!socketIds || socketIds.size === 0) {
      this.logger.debug(`emitToUser: user ${userId} has no connected sockets`);
      return;
    }
    for (const socketId of socketIds) {
      this.server.to(socketId).emit(event, data);
    }
  }

  /** Send an event to a driver (by driverId). Looks up userId from DB cache or connected map. */
  async emitToDriver(driverId: string, event: string, data: unknown) {
    // Look up the driver's userId
    const driverRecords = await this.db
      .select({ userId: drivers.userId })
      .from(drivers)
      .where(eq(drivers.id, driverId))
      .limit(1);

    const driverRecord = driverRecords[0];
    if (!driverRecord) {
      this.logger.debug(`emitToDriver: driver ${driverId} not found in DB`);
      return;
    }

    this.emitToUser(driverRecord.userId, event, data);
  }

  private async canJoinPrivateRide(
    client: AuthenticatedSocket,
    rideId: string,
  ): Promise<boolean> {
    const [ride] = await this.db
      .select({
        passengerId: rides.passengerId,
        driverId: rides.driverId,
      })
      .from(rides)
      .where(eq(rides.id, rideId))
      .limit(1);
    if (!ride) return false;

    if (client.data.role === 'passenger') {
      const [passenger] = await this.db
        .select({ id: passengers.id })
        .from(passengers)
        .where(eq(passengers.userId, client.data.userId))
        .limit(1);
      return passenger?.id === ride.passengerId;
    }

    if (client.data.role === 'driver') {
      const [driver] = await this.db
        .select({ id: drivers.id })
        .from(drivers)
        .where(eq(drivers.userId, client.data.userId))
        .limit(1);
      return driver?.id === ride.driverId;
    }

    return false;
  }

  private isValidRideId(value: unknown): value is string {
    return typeof value === 'string' && isUUID(value);
  }

  private isValidCoordinate(value: DriverLocationInput): boolean {
    return Number.isFinite(value?.latitude)
      && Number.isFinite(value?.longitude)
      && value.latitude >= -90
      && value.latitude <= 90
      && value.longitude >= -180
      && value.longitude <= 180;
  }
}
