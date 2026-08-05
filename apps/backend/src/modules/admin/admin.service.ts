import { BadRequestException, ConflictException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { Database, auditLogs, users, drivers, rides, subscriptions, vehicles, passengers } from '@kansride/db';
import { eq, desc, count, sum, and, inArray, or, ilike } from 'drizzle-orm';
import type { UserRole } from '@kansride/types';
import { RidesService } from '../rides/rides.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    private readonly ridesService: RidesService,
  ) {}

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
    const totalRevenuePesewas = Number(revenueResult?.value) || 0;

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
          farePesewas: ride.actualFarePesewas ?? ride.estimatedFarePesewas,
          createdAt: ride.createdAt.toISOString(),
        };
      }),
    );

    return {
      totalUsers,
      totalDrivers,
      activeRides,
      totalRevenuePesewas,
      recentRides,
    };
  }

  async getDrivers(page: number, limit: number, status?: string) {
    const offset = (page - 1) * limit;

    let whereClause;
    if (status === 'online') {
      whereClause = eq(drivers.isOnline, true);
    } else if (status === 'offline') {
      whereClause = eq(drivers.isOnline, false);
    } else if (status === 'pending') {
      whereClause = inArray(
        drivers.userId,
        this.db.select({ id: users.id }).from(users).where(eq(users.role, 'driver_applicant')),
      );
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
        // drivers.completedRides is an unmaintained column (never incremented
        // on ride completion) and would render 0 for every driver forever.
        // Compute the live count of completed rides per driver instead, the
        // same approach users.service uses for totalRides. The column is kept
        // for potential future maintenance but is not trusted as a counter.
        const completedRides = await this.getDriverCompletedRides(driver.id);
        return {
          id: driver.id,
          role: user[0]?.role ?? 'driver_applicant',
          name: user[0] ? `${user[0].firstName || ''} ${user[0].lastName || ''}`.trim() || user[0].phoneNumber : 'Unknown',
          phone: user[0]?.phoneNumber || '',
          isOnline: driver.isOnline,
          isActive: driver.isActive,
          vehicleRegistration: vehicle[0]?.registrationNumber || null,
          vehicleColour: vehicle[0]?.colour || null,
          subscriptionExpiresAt: driver.subscriptionExpiresAt?.toISOString() || null,
          rating: driver.rating,
          completedRides,
          createdAt: driver.createdAt.toISOString(),
        };
      }),
    );

    return { data, total, page, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getRides(page: number, limit: number, status?: string, search?: string) {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const offset = Math.max(page - 1, 0) * boundedLimit;
    const filters = [];
    if (status === 'active') {
      filters.push(inArray(rides.status, ['in_progress', 'driver_en_route', 'driver_arrived', 'searching', 'requested', 'driver_assigned'] as any));
    } else if (status === 'completed') {
      filters.push(eq(rides.status, 'completed'));
    } else if (status === 'cancelled') {
      filters.push(inArray(rides.status, ['cancelled_by_passenger', 'cancelled_by_driver', 'cancelled_by_admin'] as any));
    }
    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      const searchFilters = [ilike(users.phoneNumber, `%${normalizedSearch}%`)];
      if (normalizedSearch.length === 36) searchFilters.push(eq(rides.id, normalizedSearch));
      filters.push(or(...searchFilters));
    }
    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const baseQuery = this.db
      .select({ ride: rides, passengerPhone: users.phoneNumber })
      .from(rides)
      .innerJoin(passengers, eq(passengers.id, rides.passengerId))
      .innerJoin(users, eq(users.id, passengers.userId));
    const countQuery = this.db
      .select({ value: count() })
      .from(rides)
      .innerJoin(passengers, eq(passengers.id, rides.passengerId))
      .innerJoin(users, eq(users.id, passengers.userId));
    const [totalResult, rows] = await Promise.all([
      countQuery.where(whereClause),
      baseQuery.where(whereClause).orderBy(desc(rides.createdAt)).limit(boundedLimit).offset(offset),
    ]);
    const total = totalResult[0]?.value ?? 0;
    const data = await Promise.all(rows.map(async ({ ride, passengerPhone }) => ({
      id: ride.id,
      passengerName: await this.getPassengerName(ride.passengerId),
      passengerPhone,
      driverName: ride.driverId ? await this.getDriverName(ride.driverId) : null,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      status: ride.status,
      farePesewas: ride.actualFarePesewas ?? ride.estimatedFarePesewas,
      rideType: ride.rideType,
      createdAt: ride.createdAt.toISOString(),
    })));
    return { data, total, page, totalPages: Math.ceil(total / boundedLimit) || 1 };
  }

  async getRideDetail(rideId: string) {
    const [ride] = await this.db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
    if (!ride) throw new NotFoundException('Ride not found');
    const passenger = await this.db.select({ userId: passengers.userId }).from(passengers).where(eq(passengers.id, ride.passengerId)).limit(1);
    const passengerUser = passenger[0] ? await this.db.select({ phoneNumber: users.phoneNumber, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, passenger[0].userId)).limit(1) : [];
    const driver = ride.driverId ? await this.db.select({ userId: drivers.userId, vehicleId: drivers.vehicleId }).from(drivers).where(eq(drivers.id, ride.driverId)).limit(1) : [];
    const driverUser = driver[0] ? await this.db.select({ phoneNumber: users.phoneNumber, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, driver[0].userId)).limit(1) : [];
    const timeline = [
      { status: 'requested', at: ride.createdAt.toISOString() },
      ...(ride.status !== 'requested' ? [{ status: ride.status, at: ride.updatedAt.toISOString() }] : []),
      ...(ride.completedAt ? [{ status: 'completed', at: ride.completedAt.toISOString() }] : []),
    ];
    return {
      id: ride.id,
      status: ride.status,
      rideType: ride.rideType,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      estimatedDistanceMeters: ride.estimatedDistanceMeters,
      estimatedDurationSeconds: ride.estimatedDurationSeconds,
      estimatedFarePesewas: ride.estimatedFarePesewas,
      actualFarePesewas: ride.actualFarePesewas,
      cancellationReason: ride.cancellationReason,
      rating: ride.rating,
      ratingComment: ride.ratingComment,
      createdAt: ride.createdAt.toISOString(),
      updatedAt: ride.updatedAt.toISOString(),
      completedAt: ride.completedAt?.toISOString() ?? null,
      passenger: passengerUser[0] ? { name: [passengerUser[0].firstName, passengerUser[0].lastName].filter(Boolean).join(' ') || null, phoneNumber: passengerUser[0].phoneNumber } : null,
      driver: driverUser[0] ? { name: [driverUser[0].firstName, driverUser[0].lastName].filter(Boolean).join(' ') || null, phoneNumber: driverUser[0].phoneNumber } : null,
      timeline,
    };
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

  async approveDriver(driverId: string, adminUserId: string) {
    return this.db.transaction(async (tx) => {
      const [driver] = await tx
        .select({ id: drivers.id, userId: drivers.userId, isActive: drivers.isActive })
        .from(drivers)
        .where(eq(drivers.id, driverId))
        .limit(1);
      if (!driver) throw new NotFoundException('Driver application not found');

      const [user] = await tx
        .select({ role: users.role, status: users.status, isVerified: users.isVerified })
        .from(users)
        .where(eq(users.id, driver.userId))
        .limit(1);
      if (!user) throw new NotFoundException('Driver account not found');
      if (user.role !== 'driver_applicant') {
        throw new ConflictException('Only pending driver applications can be approved');
      }
      if (user.status !== 'active') {
        throw new BadRequestException('The driver account must be active before approval');
      }

      await tx
        .update(users)
        .set({ role: 'driver', isVerified: true, updatedAt: new Date() })
        .where(eq(users.id, driver.userId));
      await tx
        .update(drivers)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(drivers.id, driverId));
      await this.writeAudit(tx, adminUserId, driverId, 'driver_approval', {
        previousRole: user.role,
        nextRole: 'driver',
        previousActive: driver.isActive,
        nextActive: true,
      });

      return { driverId, status: 'approved' as const };
    });
  }

  async rejectDriver(driverId: string, adminUserId: string, reason?: string) {
    const normalizedReason = reason?.trim();
    if (!normalizedReason) throw new BadRequestException('A rejection reason is required');

    return this.db.transaction(async (tx) => {
      const [driver] = await tx
        .select({ id: drivers.id, userId: drivers.userId, isActive: drivers.isActive })
        .from(drivers)
        .where(eq(drivers.id, driverId))
        .limit(1);
      if (!driver) throw new NotFoundException('Driver application not found');

      const [user] = await tx
        .select({ role: users.role, isVerified: users.isVerified })
        .from(users)
        .where(eq(users.id, driver.userId))
        .limit(1);
      if (!user) throw new NotFoundException('Driver account not found');
      if (user.role !== 'driver_applicant') {
        throw new ConflictException('Only pending driver applications can be rejected');
      }

      await tx
        .update(drivers)
        .set({ isActive: false, isOnline: false, updatedAt: new Date() })
        .where(eq(drivers.id, driverId));
      await this.writeAudit(tx, adminUserId, driverId, 'driver_rejection', {
        role: user.role,
        isVerified: user.isVerified,
        isActive: driver.isActive,
        reason: normalizedReason,
      });

      return { driverId, status: 'rejected' as const, reason: normalizedReason };
    });
  }

  async updateUserStatus(userId: string, status: 'active' | 'suspended', adminUserId: string) {
    if (userId === adminUserId) throw new BadRequestException('Administrators cannot change their own status');

    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: users.id, status: users.status, role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) throw new NotFoundException('User not found');
      if (user.status === status) return { userId, status };

      await tx.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
      if (status === 'suspended') {
        await tx.update(drivers).set({ isOnline: false, isActive: false, updatedAt: new Date() }).where(eq(drivers.userId, userId));
      }
      await this.writeAudit(tx, adminUserId, userId, 'user_status_change', {
        previousStatus: user.status,
        nextStatus: status,
        role: user.role,
      });
      return { userId, status };
    });
  }

  async cancelRide(rideId: string, adminUserId: string, role: UserRole, reason?: string) {
    const result = await this.ridesService.cancelRide(rideId, adminUserId, role, reason);
    await this.db.insert(auditLogs).values({
      userId: adminUserId,
      entityType: 'ride',
      entityId: rideId,
      action: 'ride_cancellation',
      changes: { status: result.status, reason: reason ?? null },
    });
    return result;
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

  private async writeAudit(
    tx: Pick<Database, 'insert'>,
    adminUserId: string,
    entityId: string,
    action: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await tx.insert(auditLogs).values({
      userId: adminUserId,
      entityType: action.startsWith('driver_') ? 'driver' : 'user',
      entityId,
      action,
      changes,
    });
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

  private async getDriverCompletedRides(driverId: string): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(rides)
      .where(and(eq(rides.driverId, driverId), eq(rides.status, 'completed')));
    return result?.value ?? 0;
  }
}
