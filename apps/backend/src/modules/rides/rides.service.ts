import { Injectable, Inject, BadRequestException, NotFoundException, Logger, forwardRef } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../database';
import { MAPS_PROVIDER } from '../../providers';
import { IMapsProvider } from '../../providers/maps/maps.interface';
import { Database, rides, drivers, users, vehicles } from '@kansride/db';
import { eq, desc } from 'drizzle-orm';
import { FareService } from './fare.service';
import { StateMachineService } from './state-machine.service';
import { DispatchService } from './dispatch.service';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(MAPS_PROVIDER) private readonly mapsProvider: IMapsProvider,
    private readonly fareService: FareService,
    private readonly stateMachine: StateMachineService,
    private readonly dispatchService: DispatchService,
  ) {}

  async createRide(
    passengerId: string,
    data: {
      pickupLatitude: number;
      pickupLongitude: number;
      pickupAddress?: string;
      pickupLandmark?: string;
      dropoffLatitude: number;
      dropoffLongitude: number;
      dropoffAddress?: string;
      dropoffLandmark?: string;
      rideType?: string;
    },
  ) {
    // Get distance estimate from maps provider
    const distance = await this.mapsProvider.getDistance(
      { latitude: data.pickupLatitude, longitude: data.pickupLongitude },
      { latitude: data.dropoffLatitude, longitude: data.dropoffLongitude },
    );

    // Calculate fare
    const fare = this.fareService.calculateFare(
      distance.distanceMeters,
      distance.durationSeconds,
      data.rideType || 'standard_tricycle',
    );

    // Generate 4-digit verification PIN
    const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();

    // Insert ride
    const inserted = await this.db
      .insert(rides)
      .values({
        passengerId,
        pickupLatitude: data.pickupLatitude.toString(),
        pickupLongitude: data.pickupLongitude.toString(),
        pickupAddress: data.pickupAddress,
        pickupLandmark: data.pickupLandmark,
        dropoffLatitude: data.dropoffLatitude.toString(),
        dropoffLongitude: data.dropoffLongitude.toString(),
        dropoffAddress: data.dropoffAddress,
        dropoffLandmark: data.dropoffLandmark,
        status: 'requested',
        rideType: data.rideType as any || 'standard_tricycle',
        estimatedFarePesewas: fare.totalFare,
        estimatedDistanceMeters: distance.distanceMeters,
        estimatedDurationSeconds: distance.durationSeconds,
        verificationPin,
      })
      .returning();

    const ride = inserted[0]!;
    this.logger.log(`Ride created: ${ride.id}, fare: ${fare.totalFare} pesewas`);

    // Trigger dispatch engine to find nearby drivers
    this.dispatchService.dispatchRide(ride.id, data.pickupLongitude, data.pickupLatitude).catch((err) => {
      this.logger.error(`Dispatch failed for ride ${ride.id}: ${err.message}`);
    });

    return {
      ...ride,
      fareBreakdown: fare,
    };
  }

  async getRide(id: string) {
    const result = await this.db.select().from(rides).where(eq(rides.id, id)).limit(1);
    if (!result[0]) throw new NotFoundException('Ride not found');
    return result[0];
  }

  async updateStatus(id: string, newStatus: string, actor: string = 'system') {
    const ride = await this.getRide(id);
    this.stateMachine.validateTransition(ride.status, newStatus, actor);

    const updateData: Record<string, unknown> = { status: newStatus, updatedAt: new Date() };
    if (newStatus === 'completed') {
      updateData.completedAt = new Date();
    }

    await this.db
      .update(rides)
      .set(updateData as any)
      .where(eq(rides.id, id));
    this.logger.log(`Ride ${id}: ${ride.status} → ${newStatus} by ${actor}`);

    return { id, previousStatus: ride.status, newStatus };
  }

  async cancelRide(id: string, cancelledBy: string, reason?: string) {
    const ride = await this.getRide(id);

    // Determine cancellation status based on actor
    const cancelStatus = 'cancelled_by_passenger';
    this.stateMachine.validateTransition(ride.status, cancelStatus, 'passenger');

    await this.db
      .update(rides)
      .set({
        status: cancelStatus as any,
        cancelledBy,
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(rides.id, id));

    return { id, status: cancelStatus, cancelledBy, reason };
  }

  async rateRide(id: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const ride = await this.getRide(id);
    if (ride.status !== 'completed') {
      throw new BadRequestException('Can only rate completed rides');
    }

    // Update driver rating (simple average for now)
    if (ride.driverId) {
      this.logger.log(`Ride ${id} rated: ${rating}/5 for driver ${ride.driverId}`);
    }

    return { id, rating, comment };
  }

  async getPassengerRides(passengerId: string, limit = 20) {
    return this.db
      .select()
      .from(rides)
      .where(eq(rides.passengerId, passengerId))
      .orderBy(desc(rides.createdAt))
      .limit(limit);
  }

  async getDriverRides(driverId: string, limit = 20) {
    return this.db
      .select()
      .from(rides)
      .where(eq(rides.driverId, driverId))
      .orderBy(desc(rides.createdAt))
      .limit(limit);
  }

  async getTrackingData(id: string) {
    const result = await this.db.select().from(rides).where(eq(rides.id, id)).limit(1);
    if (!result[0]) throw new NotFoundException('Ride not found');

    const ride = result[0];

    let driverFirstName: string | null = null;
    let vehicleColour: string | null = null;
    let vehiclePlate: string | null = null;

    if (ride.driverId) {
      const driverResult = await this.db
        .select({
          userId: drivers.userId,
          vehicleId: drivers.vehicleId,
        })
        .from(drivers)
        .where(eq(drivers.id, ride.driverId))
        .limit(1);

      const driver = driverResult[0];
      if (driver) {
        // Get driver's first name
        const userResult = await this.db
          .select({ firstName: users.firstName })
          .from(users)
          .where(eq(users.id, driver.userId))
          .limit(1);
        driverFirstName = userResult[0]?.firstName || null;

        // Get vehicle info
        if (driver.vehicleId) {
          const vehicleResult = await this.db
            .select({
              colour: vehicles.colour,
              registrationNumber: vehicles.registrationNumber,
            })
            .from(vehicles)
            .where(eq(vehicles.id, driver.vehicleId))
            .limit(1);

          if (vehicleResult[0]) {
            vehicleColour = vehicleResult[0].colour;
            // Mask plate partially for privacy (show first 3 and last 1)
            const plate = vehicleResult[0].registrationNumber;
            vehiclePlate = plate.length > 4
              ? plate.slice(0, 3) + '***' + plate.slice(-1)
              : plate;
          }
        }
      }
    }

    return {
      id: ride.id,
      status: ride.status,
      pickupLatitude: ride.pickupLatitude,
      pickupLongitude: ride.pickupLongitude,
      pickupAddress: ride.pickupAddress,
      dropoffLatitude: ride.dropoffLatitude,
      dropoffLongitude: ride.dropoffLongitude,
      dropoffAddress: ride.dropoffAddress,
      driverFirstName,
      vehicleColour,
      vehiclePlate,
      estimatedFare: ride.estimatedFarePesewas,
      estimatedDurationSeconds: ride.estimatedDurationSeconds,
      rideType: ride.rideType,
      createdAt: ride.createdAt,
    };
  }
}
