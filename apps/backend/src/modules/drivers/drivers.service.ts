import { Injectable, Inject, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DATABASE_TOKEN } from '../../database';
import { REDIS_SERVICE } from '../../redis';
import { PAYMENT_PROVIDER } from '../../providers';
import { IRedisService } from '../../redis/redis.interface';
import { IPaymentProvider, PaymentMethod } from '../../providers/payments/payment.interface';
import { Database, users, drivers, vehicles, subscriptions, rides } from '@kansride/db';
import { eq, and, lt, gt } from 'drizzle-orm';

const DRIVERS_GEO_KEY = 'drivers:online:locations';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(REDIS_SERVICE) private readonly redis: IRedisService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: IPaymentProvider,
  ) {}

  /**
   * Resolve the `drivers` row for an authenticated user by their `users.id`.
   * Throws NotFoundException when no driver profile exists for that user.
   * Used by every controller method that needs `drivers.id` (go-online,
   * go-offline, location update, subscribe, earnings) so that the controller
   * never has to know how the JWT `userId` maps to `drivers.id`.
   *
   * Identity flow:
   *   JWT.userId  ==  users.id  ->  drivers.userId  ->  drivers.id
   */
  private async resolveDriverByUserId(authenticatedUserId: string) {
    const driverRecords = await this.db
      .select()
      .from(drivers)
      .where(eq(drivers.userId, authenticatedUserId))
      .limit(1);
    const driver = driverRecords[0];
    if (!driver) {
      throw new NotFoundException(`Driver profile not found for user ${authenticatedUserId}`);
    }
    return driver;
  }

  async getDriverProfile(userId: string) {
    const driverRecords = await this.db.select().from(drivers).where(eq(drivers.userId, userId)).limit(1);
    const driver = driverRecords[0];
    if (!driver) return { isDriver: false };

    const vehicleRecords = driver.vehicleId
      ? await this.db.select().from(vehicles).where(eq(vehicles.id, driver.vehicleId)).limit(1)
      : [];

    const hasSubscription = await this.hasActiveSubscription(driver.id);

    return {
      isDriver: true,
      driverId: driver.id,
      isOnline: driver.isOnline,
      isActive: driver.isActive,
      rating: driver.rating,
      completedRides: driver.completedRides,
      subscriptionActive: hasSubscription,
      subscriptionExpiresAt: driver.subscriptionExpiresAt,
      vehicle: vehicleRecords[0] || null,
    };
  }

  /**
   * Go online for an authenticated user. Resolves `drivers.id` from the
   * JWT's `userId` (== users.id) via `drivers.userId`, then delegates to
   * setOnlineStatus. Throws NotFoundException when the user has no driver
   * profile (e.g. passenger / driver_applicant with no row yet).
   */
  async goOnlineByUserId(authenticatedUserId: string, location: { latitude: number; longitude: number }) {
    const driver = await this.resolveDriverByUserId(authenticatedUserId);
    return this.setOnlineStatus(driver.id, true, location);
  }

  /**
   * Go offline for an authenticated user. See goOnlineByUserId for the
   * identity resolution contract.
   */
  async goOfflineByUserId(authenticatedUserId: string) {
    const driver = await this.resolveDriverByUserId(authenticatedUserId);
    return this.setOnlineStatus(driver.id, false);
  }

  /**
   * Update the authenticated driver's current location. Resolves
   * `drivers.id` from the JWT's `userId` and delegates to updateLocation.
   */
  async updateLocationByUserId(authenticatedUserId: string, latitude: number, longitude: number) {
    const driver = await this.resolveDriverByUserId(authenticatedUserId);
    return this.updateLocation(driver.id, latitude, longitude);
  }

  /**
   * Subscribe for an authenticated driver. Resolves `drivers.id` from the
   * JWT's `userId` and delegates to subscribe.
   */
  async subscribeByUserId(authenticatedUserId: string, paymentMethod: string) {
    const driver = await this.resolveDriverByUserId(authenticatedUserId);
    return this.subscribe(driver.id, paymentMethod);
  }

  /**
   * Get earnings for an authenticated driver. Resolves `drivers.id` from
   * the JWT's `userId` and delegates to getEarnings.
   */
  async getEarningsByUserId(authenticatedUserId: string) {
    const driver = await this.resolveDriverByUserId(authenticatedUserId);
    return this.getEarnings(driver.id);
  }

  async register(userId: string, data: { licenseNumber: string; vehicleRegistration: string; vehicleColour: string; vehicleMake?: string; vehicleModel?: string }) {
    // Check if user already has a driver profile
    const existing = await this.db.select().from(drivers).where(eq(drivers.userId, userId)).limit(1);
    if (existing[0]) {
      throw new BadRequestException('User already registered as a driver');
    }

    // Update user role to driver_applicant
    await this.db.update(users).set({ role: 'driver_applicant' }).where(eq(users.id, userId));

    // Create vehicle
    const [vehicle] = await this.db.insert(vehicles).values({
      registrationNumber: data.vehicleRegistration,
      type: 'tricycle',
      colour: data.vehicleColour,
      make: data.vehicleMake,
      model: data.vehicleModel,
      ownerId: userId,
      status: 'active',
    }).returning();

    if (!vehicle) {
      throw new BadRequestException('Failed to create vehicle record');
    }

    // Create driver record
    const [driver] = await this.db.insert(drivers).values({
      userId,
      licenseNumber: data.licenseNumber,
      vehicleId: vehicle.id,
      rating: '5.00',
      isOnline: false,
      isActive: false,
      completedRides: 0,
    }).returning();

    if (!driver) {
      throw new BadRequestException('Failed to create driver record');
    }

    this.logger.log(`Driver registered: ${driver.id} (user: ${userId})`);
    return { message: 'Registration submitted for review', driverId: driver.id, status: 'pending' };
  }

  async setOnlineStatus(driverId: string, online: boolean, location?: { latitude: number; longitude: number }) {
    const driver = await this.db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
    if (!driver[0]) throw new NotFoundException('Driver not found');

    if (online) {
      // Check active subscription
      const hasSubscription = await this.hasActiveSubscription(driverId);
      if (!hasSubscription) {
        throw new BadRequestException('Active subscription required to go online. Subscribe first.');
      }

      if (!location) {
        throw new BadRequestException('Location required to go online');
      }

      // Update DB
      await this.db.update(drivers).set({
        isOnline: true,
        currentLatitude: location.latitude.toString(),
        currentLongitude: location.longitude.toString(),
        updatedAt: new Date(),
      }).where(eq(drivers.id, driverId));

      // Add to Redis geo-index
      await this.redis.geoAdd(DRIVERS_GEO_KEY, location.longitude, location.latitude, driverId);

      this.logger.log(`Driver ${driverId} is now ONLINE at (${location.latitude}, ${location.longitude})`);
    } else {
      // Go offline
      await this.db.update(drivers).set({
        isOnline: false,
        updatedAt: new Date(),
      }).where(eq(drivers.id, driverId));

      // Remove from geo-index
      await this.redis.geoRemove(DRIVERS_GEO_KEY, driverId);

      this.logger.log(`Driver ${driverId} is now OFFLINE`);
    }

    return { driverId, online, location };
  }

  async updateLocation(driverId: string, latitude: number, longitude: number) {
    // Update Redis geo-index
    await this.redis.geoAdd(DRIVERS_GEO_KEY, longitude, latitude, driverId);

    // Update DB
    await this.db.update(drivers).set({
      currentLatitude: latitude.toString(),
      currentLongitude: longitude.toString(),
      updatedAt: new Date(),
    }).where(eq(drivers.id, driverId));
  }

  async subscribe(driverId: string, paymentMethod: string) {
    const driver = await this.db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
    if (!driver[0]) throw new NotFoundException('Driver not found');

    // Get user phone for payment
    const user = await this.db.select().from(users).where(eq(users.id, driver[0].userId)).limit(1);
    if (!user[0]) throw new NotFoundException('User not found');

    // Initiate payment (1000 pesewas = GHS 10.00)
    const amountPesewas = 1000;
    const payResult = await this.paymentProvider.initiate(
      amountPesewas,
      paymentMethod as PaymentMethod,
      user[0].phoneNumber,
      'KansRide Daily Subscription',
    );

    if (payResult.status === 'success') {
      // Create subscription
      const startDate = new Date();
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await this.db.insert(subscriptions).values({
        driverId,
        amountPesewas,
        startDate,
        endDate,
        status: 'active',
      });

      // Update driver subscription expiry
      await this.db.update(drivers).set({
        subscriptionExpiresAt: endDate,
        isActive: true,
        updatedAt: new Date(),
      }).where(eq(drivers.id, driverId));

      this.logger.log(`Driver ${driverId} subscribed until ${endDate.toISOString()}`);
      return { message: 'Subscription activated', expiresAt: endDate, amountPesewas, reference: payResult.reference };
    }

    return { message: 'Payment pending', reference: payResult.reference, status: payResult.status };
  }

  async getEarnings(driverId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Today's earnings
    const todayRides = await this.db.select().from(rides)
      .where(and(
        eq(rides.driverId, driverId),
        eq(rides.status, 'completed'),
        gt(rides.completedAt, today),
      ));

    // This week's earnings
    const weekRides = await this.db.select().from(rides)
      .where(and(
        eq(rides.driverId, driverId),
        eq(rides.status, 'completed'),
        gt(rides.completedAt, weekAgo),
      ));

    const todayPesewas = todayRides.reduce(
      (sum, ride) =>
        sum + (ride.actualFarePesewas ?? ride.estimatedFarePesewas),
      0,
    );
    const thisWeekPesewas = weekRides.reduce(
      (sum, ride) =>
        sum + (ride.actualFarePesewas ?? ride.estimatedFarePesewas),
      0,
    );

    return {
      todayPesewas,
      thisWeekPesewas,
      todayRides: todayRides.length,
      weekRides: weekRides.length,
    };
  }

  async hasActiveSubscription(driverId: string): Promise<boolean> {
    const activeSubs = await this.db.select().from(subscriptions)
      .where(and(
        eq(subscriptions.driverId, driverId),
        eq(subscriptions.status, 'active'),
        gt(subscriptions.endDate, new Date()),
      ))
      .limit(1);
    return activeSubs.length > 0;
  }

  async findNearbyDrivers(longitude: number, latitude: number, radiusKm: number) {
    return this.redis.geoSearch(DRIVERS_GEO_KEY, longitude, latitude, radiusKm);
  }

  // Scheduled: check for expired subscriptions every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleSubscriptionExpiry() {
    const now = new Date();

    // Find drivers with expired subscriptions who are still online
    const expiredDrivers = await this.db.select().from(drivers)
      .where(and(
        eq(drivers.isOnline, true),
        lt(drivers.subscriptionExpiresAt, now),
      ));

    for (const driver of expiredDrivers) {
      await this.db.update(drivers).set({
        isOnline: false,
        isActive: false,
        updatedAt: now,
      }).where(eq(drivers.id, driver.id));

      await this.redis.geoRemove(DRIVERS_GEO_KEY, driver.id);
      this.logger.log(`Driver ${driver.id} set offline — subscription expired`);
    }

    if (expiredDrivers.length > 0) {
      this.logger.log(`Subscription expiry: ${expiredDrivers.length} drivers set offline`);
    }
  }
}
