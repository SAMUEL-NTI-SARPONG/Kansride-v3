import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { Database, users, drivers, rides, subscriptions, vehicles, passengers } from '@kansride/db';
import { eq, desc, count, sum, and, sql, inArray } from 'drizzle-orm';

@Injectable()
export class AdminService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async getDashboardStats() {
    // Total users
    const [userCount] = await this.db.select({ value: count() }).from(users);
    const totalUsers = userCount?.value ?? 0;

    // Total drivers
    const [driverCount] = await this.db.select({ value: count() }).from(drivers);
    const totalDrivers = driverCount?.value ?? 0;

    // Active rides (in_progress, driver_en_route, driver_arrived, searching, requested, driver_assigned)
    const activeStatuses = ['in_progress', 'driver_en_route', 'driver_arrived', 'searching', 'requested', 'driver_assigned'];
    const [activeRideCount] = await this.db
      .select({ value: count() })
      .from(rides)
      .where(inArray(rides.status, activeStatuses as any));
    const activeRides = activeRideCount?.value ?? 0;

    // Total revenue from completed rides
    const [revenueResult] = await this.db
      .select({ value: sum(rides.actualFarePesewas) })
      .from(rides)
      .where(eq(rides.status, 'completed'));
    const totalRevenue = Number(revenueResult?.value) || 0;

    // Recent rides (last 10)
    const recentRidesRaw = await this.db
      .select()
      .from(rides)
      .orderBy(desc(rides.createdAt))
      .limit(10);

    // Get passenger and driver names for recent rides
    const recentRides = await Promise.all(
      recentRidesRaw.map(async (ride) => {
        const passengerName = await this.getPassengerName(ride.passengerId);
        const driverName = ride.driverId ? await this.getDriverName(ride.driverId) : null;
        return {
          id: ride.id,
          passengerName,
          driverName,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          status: ride.status,
          fare: ride.actualFarePesewas || ride.estimatedFarePesewas,
          createdAt: ride.createdAt.toISOString(),
        };
      }),
    );

    return { totalUsers, totalDrivers, activeRides, totalRevenue, recentRides };
  }

  async getDrivers(page: number, limit: number, status?: string) {
    const offset = (page - 1) * limit;

    let whereClause;
    if (status === 'online') {
      whereClause = eq(drivers.isOnline, true);
    } else if (status === 'offline') {
      whereClause = eq(drivers.isOnline, false);
    }

    const [totalResult] = await this.db
      .select({ value: count() })
      .from(drivers)
      .where(whereClause);
    const total = totalResult?.value ?? 0;

    const driversRaw = await this.db
      .select()
      .from(drivers)
      .where(whereClause)
      .orderBy(desc(drivers.createdAt))
      .limit(limit)
      .offset(offset);

    const data = await Promise.all(
      driversRaw.map(async (driver) => {
        const user = await this.db.select().from(users).where(eq(users.id, driver.userId)).limit(1);
        const vehicle = driver.vehicleId
          ? await this.db.select().from(vehicles).where(eq(vehicles.id, driver.vehicleId)).limit(1)
          : [];
        return {
          id: driver.id,
          name: user[0] ? `${user[0].firstName || ''} ${user[0].lastName || ''}`.trim() || user[0].phoneNumber : 'Unknown',
          phone: user[0]?.phoneNumber || '',
          isOnline: driver.isOnline,
          isActive: driver.isActive,
          vehicleRegistration: vehicle[0]?.registrationNumber || null,
          vehicleColour: vehicle[0]?.colour || null,
          subscriptionExpiresAt: driver.subscriptionExpiresAt?.toISOString() || null,
          rating: driver.rating,
          completedRides: driver.completedRides,
          createdAt: driver.createdAt.toISOString(),
        };
      }),
    );

    return { data, total, page, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getRides(page: number, limit: number, status?: string) {
    const offset = (page - 1) * limit;

    let whereClause;
    if (status === 'active') {
      whereClause = inArray(rides.status, ['in_progress', 'driver_en_route', 'driver_arrived', 'searching', 'requested', 'driver_assigned'] as any);
    } else if (status === 'completed') {
      whereClause = eq(rides.status, 'completed');
    } else if (status === 'cancelled') {
      whereClause = inArray(rides.status, ['cancelled_by_passenger', 'cancelled_by_driver', 'cancelled_by_admin'] as any);
    }

    const [totalResult] = await this.db
      .select({ value: count() })
      .from(rides)
      .where(whereClause);
    const total = totalResult?.value ?? 0;

    const ridesRaw = await this.db
      .select()
      .from(rides)
      .where(whereClause)
      .orderBy(desc(rides.createdAt))
      .limit(limit)
      .offset(offset);

    const data = await Promise.all(
      ridesRaw.map(async (ride) => {
        const passengerName = await this.getPassengerName(ride.passengerId);
        const driverName = ride.driverId ? await this.getDriverName(ride.driverId) : null;
        return {
          id: ride.id,
          passengerName,
          driverName,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          status: ride.status,
          fare: ride.actualFarePesewas || ride.estimatedFarePesewas,
          rideType: ride.rideType,
          createdAt: ride.createdAt.toISOString(),
        };
      }),
    );

    return { data, total, page, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getUsers(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [totalResult] = await this.db.select({ value: count() }).from(users);
    const total = totalResult?.value ?? 0;

    const data = await this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        phoneNumber: users.phoneNumber,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: data.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getSubscriptions(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [totalResult] = await this.db.select({ value: count() }).from(subscriptions);
    const total = totalResult?.value ?? 0;

    const subsRaw = await this.db
      .select()
      .from(subscriptions)
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit)
      .offset(offset);

    const data = await Promise.all(
      subsRaw.map(async (sub) => {
        const driverName = await this.getDriverName(sub.driverId);
        return {
          id: sub.id,
          driverName,
          startDate: sub.startDate.toISOString(),
          endDate: sub.endDate.toISOString(),
          status: sub.status,
          amountPesewas: sub.amountPesewas,
          createdAt: sub.createdAt.toISOString(),
        };
      }),
    );

    return { data, total, page, totalPages: Math.ceil(total / limit) || 1 };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getPassengerName(passengerId: string): Promise<string> {
    const passenger = await this.db.select().from(passengers).where(eq(passengers.id, passengerId)).limit(1);
    if (!passenger[0]) return 'Unknown';
    const user = await this.db.select().from(users).where(eq(users.id, passenger[0].userId)).limit(1);
    if (!user[0]) return 'Unknown';
    return `${user[0].firstName || ''} ${user[0].lastName || ''}`.trim() || user[0].phoneNumber;
  }

  private async getDriverName(driverId: string): Promise<string> {
    const driver = await this.db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
    if (!driver[0]) return 'Unknown';
    const user = await this.db.select().from(users).where(eq(users.id, driver[0].userId)).limit(1);
    if (!user[0]) return 'Unknown';
    return `${user[0].firstName || ''} ${user[0].lastName || ''}`.trim() || user[0].phoneNumber;
  }
}
