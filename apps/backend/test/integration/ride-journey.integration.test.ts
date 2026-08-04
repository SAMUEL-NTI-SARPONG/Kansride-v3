import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getDb, type Database, auditLogs, closeDb, drivers, otpRequests, payments, passengers, rides, subscriptions, users, vehicles } from '@kansride/db';
import { desc, eq, inArray } from 'drizzle-orm';
import { AuthService } from '../../src/modules/auth/auth.service';
import { DispatchService } from '../../src/modules/rides/dispatch.service';
import { FareService } from '../../src/modules/rides/fare.service';
import { RidesService } from '../../src/modules/rides/rides.service';
import { StateMachineService } from '../../src/modules/rides/state-machine.service';
import { PublicTrackingService } from '../../src/modules/events/public-tracking.service';
import { RedisService } from '../../src/redis/redis.service';
import type { IRedisService } from '../../src/redis/redis.interface';
import type { ISMSProvider } from '../../src/providers/sms/sms.interface';
import type { IMapsProvider } from '../../src/providers/maps/maps.interface';
import { OTPService } from '@kansride/auth';

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl || !redisUrl) {
  throw new Error('Integration tests require DATABASE_URL and REDIS_URL; refusing to run with a fallback or missing service');
}

const runId = randomUUID().slice(0, 8);
const passengerPhone = `+23350${runId.replace(/[^0-9]/g, '').padEnd(7, '1').slice(0, 7)}`;
const driverPhone = `+23324${runId.replace(/[^0-9]/g, '').padEnd(7, '2').slice(0, 7)}`;
const competingDriverPhone = `+23327${runId.replace(/[^0-9]/g, '').padEnd(7, '4').slice(0, 7)}`;
const adminPhone = `+23320${runId.replace(/[^0-9]/g, '').padEnd(7, '3').slice(0, 7)}`;

const smsProvider: ISMSProvider = {
  sendOTP: async () => ({ success: true, messageId: `integration-${runId}` }),
};
const mapsProvider: IMapsProvider = {
  getDistance: async () => ({ distanceMeters: 1_500, durationSeconds: 360 }),
  getRoute: async () => ({ distanceMeters: 1_500, durationSeconds: 360 }),
};
let db: Database;
let redis: IRedisService;
let redisClient: { onModuleDestroy: () => Promise<void> };
let passengerUserId: string;
let passengerId: string;
let driverUserId: string;
let driverId: string;
let competingDriverUserId: string;
let competingDriverId: string;
let competingVehicleId: string;
let vehicleId: string;
let rideId: string;
let adminUserId: string;
let trackingToken: string;

async function authenticate(phoneNumber: string, role: 'passenger' | 'driver' | 'super_admin') {
  const auth = new AuthService(db, smsProvider);
  await auth.requestOTP(phoneNumber);
  const [otp] = await db.select().from(otpRequests)
    .where(eq(otpRequests.phoneNumber, phoneNumber))
    .orderBy(desc(otpRequests.createdAt))
    .limit(1);
  if (!otp) throw new Error(`OTP fixture was not created for ${phoneNumber}`);
  const rawCode = '000000';
  await db.update(otpRequests)
    .set({ codeHash: new OTPService().hashOTP(rawCode) })
    .where(eq(otpRequests.id, otp.id));
  const result = await auth.verifyOTP(phoneNumber, rawCode);
  const user = result.user;
  if (user.role !== role) {
    await db.update(users).set({ role, isVerified: true }).where(eq(users.id, user.id));
  }
  return user.id;
}

describe('V1 passenger-driver ride journey against Postgres and Redis', () => {
  beforeAll(async () => {
    db = getDb(databaseUrl!);
    redisClient = new RedisService();
    redis = redisClient;
    for (let attempt = 0; attempt < 20 && !redis.isConnected(); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!redis.isConnected()) throw new Error('Redis did not become ready for integration tests');

    passengerUserId = await authenticate(passengerPhone, 'passenger');
    driverUserId = await authenticate(driverPhone, 'driver');
    competingDriverUserId = await authenticate(competingDriverPhone, 'driver');
    adminUserId = await authenticate(adminPhone, 'super_admin');

    const [passenger] = await db.select().from(passengers).where(eq(passengers.userId, passengerUserId)).limit(1);
    if (!passenger) throw new Error('Passenger profile was not created');
    passengerId = passenger.id;

    const [vehicle] = await db.insert(vehicles).values({
      registrationNumber: `INT-${runId}`,
      type: 'tricycle',
      colour: 'blue',
      make: 'KansRide',
      model: 'Pilot',
      ownerId: driverUserId,
      status: 'active',
    }).returning();
    if (!vehicle) throw new Error('Vehicle fixture was not created');
    vehicleId = vehicle.id;

    const [driver] = await db.insert(drivers).values({
      userId: driverUserId,
      licenseNumber: `INT-LIC-${runId}`,
      vehicleId,
      isOnline: true,
      isActive: true,
      currentLatitude: '5.60300000',
      currentLongitude: '-0.18700000',
      updatedAt: new Date(),
    }).returning();
    if (!driver) throw new Error('Driver fixture was not created');
    driverId = driver.id;

    const [competingVehicle] = await db.insert(vehicles).values({
      registrationNumber: `INT-C-${runId}`,
      type: 'tricycle',
      colour: 'green',
      make: 'KansRide',
      model: 'Pilot',
      ownerId: competingDriverUserId,
      status: 'active',
    }).returning();
    if (!competingVehicle) throw new Error('Competing vehicle fixture was not created');
    competingVehicleId = competingVehicle.id;
    const [competingDriver] = await db.insert(drivers).values({
      userId: competingDriverUserId,
      licenseNumber: `INT-C-LIC-${runId}`,
      vehicleId: competingVehicleId,
      isOnline: true,
      isActive: true,
      currentLatitude: '5.60350000',
      currentLongitude: '-0.18750000',
      updatedAt: new Date(),
    }).returning();
    if (!competingDriver) throw new Error('Competing driver fixture was not created');
    competingDriverId = competingDriver.id;

    await db.update(users).set({ role: 'driver', isVerified: true, status: 'active' }).where(inArray(users.id, [driverUserId, competingDriverUserId]));
    const now = new Date();
    await db.insert(subscriptions).values([
      {
        driverId,
        amountPesewas: 1_000,
        startDate: now,
        endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        status: 'active',
      },
      {
        driverId: competingDriverId,
        amountPesewas: 1_000,
        startDate: now,
        endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        status: 'active',
      },
    ]);
    await redis.geoAdd('drivers:online:locations', -0.187, 5.603, driverId);
    await redis.geoAdd('drivers:online:locations', -0.1875, 5.6035, competingDriverId);
  });

  it('creates, dispatches, assigns exactly once, completes, tracks, and rates a ride', async () => {
    const events = {
      emitRideUpdate: () => undefined,
      emitToUser: () => undefined,
      emitToDriver: async () => undefined,
    };
    const publicTracking = new PublicTrackingService(db, redis);
    const dispatch = new DispatchService(db, redis, events as never);
    const ridesService = new RidesService(
      db,
      mapsProvider,
      new FareService(),
      new StateMachineService(),
      dispatch,
      events as never,
    );

    const created = await ridesService.createRide(passengerUserId, {
      pickupLatitude: 5.603,
      pickupLongitude: -0.187,
      pickupAddress: 'Integration Pickup',
      dropoffLatitude: 5.61,
      dropoffLongitude: -0.19,
      dropoffAddress: 'Integration Dropoff',
      rideType: 'standard_tricycle',
    });
    rideId = created.id;
    expect(Number.isInteger(created.estimatedFarePesewas)).toBe(true);

    let offers = await dispatch.getDriverOffers(driverId);
    let competingOffers = await dispatch.getDriverOffers(competingDriverId);
    for (let attempt = 0; attempt < 20 && (offers.length === 0 || competingOffers.length === 0); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      offers = await dispatch.getDriverOffers(driverId);
      competingOffers = await dispatch.getDriverOffers(competingDriverId);
    }
    expect(offers).toHaveLength(1);
    expect(competingOffers).toHaveLength(1);

    const [first, second] = await Promise.all([
      dispatch.driverAcceptRide(rideId, driverId),
      dispatch.driverAcceptRide(rideId, competingDriverId),
    ]);
    expect([first.success, second.success].filter(Boolean)).toHaveLength(1);
    const winnerDriverId = first.success ? driverId : competingDriverId;
    const winnerUserId = first.success ? driverUserId : competingDriverUserId;

    const assigned = await ridesService.getRide(rideId);
    expect(assigned.driverId).toBe(winnerDriverId);
    expect(assigned.status).toBe('driver_assigned');

    const link = await publicTracking.createLink(rideId, passengerUserId, 'passenger');
    trackingToken = link.trackingToken;
    const snapshot = await publicTracking.getSnapshot(trackingToken);
    expect(snapshot.publicReference).toMatch(/^KR-/);
    await expect(publicTracking.getSnapshot(`${trackingToken.slice(0, -1)}x`)).rejects.toThrow();

    await ridesService.updateStatus(rideId, 'driver_en_route', winnerUserId, 'driver');
    await ridesService.updateStatus(rideId, 'driver_arrived', winnerUserId, 'driver');
    await ridesService.updateStatus(rideId, 'waiting_for_passenger', winnerUserId, 'driver');
    await ridesService.verifyPassenger(rideId, created.verificationPin, winnerUserId, 'driver');
    await ridesService.updateStatus(rideId, 'in_progress', winnerUserId, 'driver');
    await ridesService.updateStatus(rideId, 'completed', winnerUserId, 'driver');

    const completed = await ridesService.getRide(rideId);
    expect(completed.status).toBe('completed');
    expect(completed.actualFarePesewas).toBe(created.estimatedFarePesewas);

    await expect(publicTracking.getSnapshot(trackingToken)).rejects.toThrow();
    await expect(
      ridesService.rateRide(rideId, passengerUserId, 'passenger', 5, 'integration'),
    ).resolves.toMatchObject({ id: rideId, rating: 5 });
    await expect(
      ridesService.rateRide(rideId, passengerUserId, 'passenger', 5, 'duplicate'),
    ).rejects.toThrow(/already been rated/);
  });

  it('rejects unauthorized tracking and preserves actor-scoped cancellation', async () => {
    const publicTracking = new PublicTrackingService(db, redis);
    await expect(publicTracking.createLink(rideId, driverUserId, 'driver')).rejects.toThrow();

    const [activeRide] = await db.insert(rides).values({
      passengerId,
      pickupLatitude: '5.60300000',
      pickupLongitude: '-0.18700000',
      dropoffLatitude: '5.61000000',
      dropoffLongitude: '-0.19000000',
      status: 'requested',
      rideType: 'standard_tricycle',
      estimatedFarePesewas: 500,
      verificationPin: '4321',
    }).returning();
    if (!activeRide) throw new Error('Active cancellation fixture was not created');
    const ridesService = new RidesService(
      db,
      mapsProvider,
      new FareService(),
      new StateMachineService(),
      new DispatchService(db, redis, { emitRideUpdate: () => undefined } as never),
      { emitRideUpdate: () => undefined, emitToUser: () => undefined, emitToDriver: async () => undefined } as never,
    );
    await expect(ridesService.cancelRide(activeRide.id, driverUserId, 'driver', 'late')).rejects.toThrow();
    await db.delete(rides).where(eq(rides.id, activeRide.id));
  });

  afterAll(async () => {
    if (!db) return;
    if (rideId) await db.delete(rides).where(eq(rides.id, rideId));
    if (driverId || competingDriverId) {
      await db.delete(subscriptions).where(inArray(subscriptions.driverId, [driverId, competingDriverId].filter(Boolean)));
      await db.delete(drivers).where(inArray(drivers.id, [driverId, competingDriverId].filter(Boolean)));
    }
    if (vehicleId || competingVehicleId) {
      await db.delete(vehicles).where(inArray(vehicles.id, [vehicleId, competingVehicleId].filter(Boolean)));
    }
    if (passengerId) await db.delete(passengers).where(eq(passengers.id, passengerId));
    const userIds = [passengerUserId, driverUserId, competingDriverUserId, adminUserId].filter(Boolean);
    if (userIds.length) {
      await db.delete(auditLogs).where(inArray(auditLogs.userId, userIds));
      await db.delete(payments).where(inArray(payments.userId, userIds));
      await db.delete(users).where(inArray(users.id, userIds));
    }
    await redisClient?.onModuleDestroy();
    await closeDb();
  });
});
