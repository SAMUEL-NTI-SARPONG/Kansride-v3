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
import { JWTService } from '@kansride/auth';
import { DATABASE_TOKEN } from '../../database';
import { REDIS_SERVICE } from '../../redis';
import { IRedisService } from '../../redis/redis.interface';
import { Database, rides, drivers } from '@kansride/db';
import { eq, and, inArray } from 'drizzle-orm';
import { DispatchService } from '../rides/dispatch.service';
import type { RideUpdatePayload } from '@kansride/types';

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

  /** Map of userId → Set of socket IDs */
  private readonly connectedUsers = new Map<string, Set<string>>();

  /** Map of driverId → last DB update timestamp (for debouncing) */
  private readonly lastDbUpdate = new Map<string, number>();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(REDIS_SERVICE) private readonly redis: IRedisService,
    @Inject(forwardRef(() => DispatchService)) private readonly dispatchService: DispatchService,
  ) {
    this.jwtService = new JWTService({
      accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
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
    @MessageBody() data: { latitude: number; longitude: number },
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

    // Update Redis geo-index (always)
    await this.redis.geoAdd(DRIVERS_GEO_KEY, data.longitude, data.latitude, driverId);

    // Debounce DB update to max once every 5 seconds per driver
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

    // Check if driver has an active ride — broadcast location to ride room
    const activeRideStatuses = [
      'driver_assigned',
      'driver_en_route',
      'driver_arrived',
      'in_progress',
    ] as const;

    const activeRides = await this.db
      .select({ id: rides.id })
      .from(rides)
      .where(
        and(eq(rides.driverId, driverId), inArray(rides.status, [...activeRideStatuses])),
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
      return { event: 'ack', data: { success: true, message: result.message } };
    } else {
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

    await this.dispatchService.driverDeclineRide(data.rideId, driverRecord.id);
    return { event: 'ack', data: { declined: true } };
  }

  @SubscribeMessage('ride:subscribe')
  handleRideSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { rideId: string },
  ) {
    if (!client.data?.userId) {
      return { event: 'error', data: { message: 'Not authenticated' } };
    }

    client.join(`ride:${data.rideId}`);
    this.logger.debug(`User ${client.data.userId} subscribed to ride:${data.rideId}`);
    return { event: 'ack', data: { subscribed: data.rideId } };
  }

  // ─── Public Methods for Other Services ──────────────────────────────────────

  /** Broadcast a ride update to all sockets in the ride room */
  emitRideUpdate(rideId: string, data: RideUpdatePayload) {
    this.server.to(`ride:${rideId}`).emit('ride:update', data);
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
}
