import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DATABASE_TOKEN } from '../../database';
import { REDIS_SERVICE } from '../../redis';
import type { IRedisService } from '../../redis/redis.interface';
import {
  Database,
  drivers,
  passengers,
  rides,
  users,
  vehicles,
} from '@kansride/db';
import { eq } from 'drizzle-orm';
import type {
  PublicTrackingLink,
  PublicTrackingSnapshot,
  RideStatus,
} from '@kansride/types';

const TRACKING_TTL_SECONDS = 6 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TERMINAL_STATUSES = new Set<RideStatus>([
  'completed',
  'cancelled_by_passenger',
  'cancelled_by_driver',
  'cancelled_by_admin',
  'no_driver_found',
  'passenger_no_show',
  'driver_no_show',
  'payment_failed',
]);

interface TrackingGrant {
  rideId: string;
  publicReference: string;
  expiresAt: string;
}

@Injectable()
export class PublicTrackingService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(REDIS_SERVICE) private readonly redis: IRedisService,
  ) {}

  async createLink(
    rideId: string,
    authenticatedUserId: string,
    role: string,
  ): Promise<PublicTrackingLink> {
    if (role !== 'passenger') {
      throw new ForbiddenException('Only the ride passenger can create a tracking link');
    }

    const [passenger] = await this.db
      .select({ id: passengers.id })
      .from(passengers)
      .where(eq(passengers.userId, authenticatedUserId))
      .limit(1);
    if (!passenger) {
      throw new ForbiddenException('No passenger profile found for this account');
    }

    const [ride] = await this.db
      .select({ passengerId: rides.passengerId, status: rides.status })
      .from(rides)
      .where(eq(rides.id, rideId))
      .limit(1);
    if (!ride || ride.passengerId !== passenger.id) {
      throw new NotFoundException('Ride not found');
    }
    if (TERMINAL_STATUSES.has(ride.status)) {
      throw new BadRequestException('Tracking is no longer available for this ride');
    }

    const trackingToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(trackingToken);
    const expiresAt = new Date(Date.now() + TRACKING_TTL_SECONDS * 1000).toISOString();
    const grant: TrackingGrant = {
      rideId,
      publicReference: this.publicReference(tokenHash),
      expiresAt,
    };

    await this.redis.set(
      this.tokenKey(tokenHash),
      JSON.stringify(grant),
      TRACKING_TTL_SECONDS,
    );
    await this.redis.sAdd(this.rideIndexKey(rideId), tokenHash);
    await this.redis.expire(this.rideIndexKey(rideId), TRACKING_TTL_SECONDS);

    return {
      trackingToken,
      trackingPath: `/track/${trackingToken}`,
      expiresAt,
    };
  }

  async resolveToken(token: string): Promise<TrackingGrant> {
    if (!TOKEN_PATTERN.test(token)) {
      throw new NotFoundException('Tracking link is invalid or expired');
    }

    const tokenHash = this.hashToken(token);
    const stored = await this.redis.get(this.tokenKey(tokenHash));
    if (!stored) {
      throw new NotFoundException('Tracking link is invalid or expired');
    }

    let grant: TrackingGrant;
    try {
      grant = JSON.parse(stored) as TrackingGrant;
    } catch {
      await this.redis.del(this.tokenKey(tokenHash));
      throw new NotFoundException('Tracking link is invalid or expired');
    }

    if (
      typeof grant.rideId !== 'string'
      || typeof grant.publicReference !== 'string'
      || typeof grant.expiresAt !== 'string'
      || Date.parse(grant.expiresAt) <= Date.now()
    ) {
      await this.redis.del(this.tokenKey(tokenHash));
      throw new NotFoundException('Tracking link is invalid or expired');
    }

    const [ride] = await this.db
      .select({ status: rides.status })
      .from(rides)
      .where(eq(rides.id, grant.rideId))
      .limit(1);
    if (!ride || TERMINAL_STATUSES.has(ride.status)) {
      await this.revokeTokenHash(grant.rideId, tokenHash);
      throw new NotFoundException('Tracking link is invalid or expired');
    }

    return grant;
  }

  async getSnapshot(token: string): Promise<PublicTrackingSnapshot> {
    const grant = await this.resolveToken(token);
    const [row] = await this.db
      .select({
        status: rides.status,
        rideType: rides.rideType,
        pickupAddress: rides.pickupAddress,
        dropoffAddress: rides.dropoffAddress,
        estimatedDurationSeconds: rides.estimatedDurationSeconds,
        createdAt: rides.createdAt,
        updatedAt: rides.updatedAt,
        driverFirstName: users.firstName,
        vehicleColour: vehicles.colour,
        vehiclePlate: vehicles.registrationNumber,
      })
      .from(rides)
      .leftJoin(drivers, eq(rides.driverId, drivers.id))
      .leftJoin(users, eq(drivers.userId, users.id))
      .leftJoin(vehicles, eq(drivers.vehicleId, vehicles.id))
      .where(eq(rides.id, grant.rideId))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Tracking link is invalid or expired');
    }
    if (TERMINAL_STATUSES.has(row.status)) {
      await this.revokeRide(grant.rideId);
      throw new NotFoundException('Tracking link is invalid or expired');
    }

    return {
      publicReference: grant.publicReference,
      status: row.status,
      rideType: row.rideType,
      pickupAddress: row.pickupAddress,
      dropoffAddress: row.dropoffAddress,
      driverFirstName: row.driverFirstName,
      vehicleColour: row.vehicleColour,
      maskedVehiclePlate: this.maskPlate(row.vehiclePlate),
      estimatedDurationSeconds: row.estimatedDurationSeconds,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getTokenHashesForRide(rideId: string): Promise<string[]> {
    return this.redis.sMembers(this.rideIndexKey(rideId));
  }

  async isTokenHashActive(tokenHash: string): Promise<boolean> {
    return (await this.redis.get(this.tokenKey(tokenHash))) !== null;
  }

  async removeExpiredTokenHash(rideId: string, tokenHash: string): Promise<void> {
    await this.redis.sRem(this.rideIndexKey(rideId), tokenHash);
  }

  async revokeRide(rideId: string): Promise<void> {
    const tokenHashes = await this.getTokenHashesForRide(rideId);
    await Promise.all(tokenHashes.map((hash) => this.redis.del(this.tokenKey(hash))));
    await this.redis.del(this.rideIndexKey(rideId));
  }

  async revokeForOwner(
    rideId: string,
    authenticatedUserId: string,
    role: string,
  ): Promise<{ revoked: true }> {
    if (role !== 'passenger') {
      throw new ForbiddenException('Only the ride passenger can revoke tracking links');
    }
    const [passenger] = await this.db
      .select({ id: passengers.id })
      .from(passengers)
      .where(eq(passengers.userId, authenticatedUserId))
      .limit(1);
    const [ride] = await this.db
      .select({ passengerId: rides.passengerId })
      .from(rides)
      .where(eq(rides.id, rideId))
      .limit(1);
    if (!passenger || ride?.passengerId !== passenger.id) {
      throw new NotFoundException('Ride not found');
    }
    await this.revokeRide(rideId);
    return { revoked: true };
  }

  isTerminal(status: RideStatus): boolean {
    return TERMINAL_STATUSES.has(status);
  }

  roomForTokenHash(tokenHash: string): string {
    return `public-track:${tokenHash}`;
  }

  tokenHash(token: string): string {
    return this.hashToken(token);
  }

  private async revokeTokenHash(rideId: string, tokenHash: string): Promise<void> {
    await this.redis.del(this.tokenKey(tokenHash));
    await this.redis.sRem(this.rideIndexKey(rideId), tokenHash);
  }

  private tokenKey(tokenHash: string): string {
    return `tracking:token:${tokenHash}`;
  }

  private rideIndexKey(rideId: string): string {
    return `tracking:ride:${rideId}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private publicReference(tokenHash: string): string {
    return `KR-${tokenHash.slice(0, 10).toUpperCase()}`;
  }

  private maskPlate(plate: string | null): string | null {
    if (!plate) return null;
    return plate.length > 4
      ? `${plate.slice(0, 3)}***${plate.slice(-1)}`
      : plate;
  }
}
