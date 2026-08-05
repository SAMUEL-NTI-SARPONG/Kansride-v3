import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { Database } from '@kansride/db';
import type { IMapsProvider } from '../src/providers/maps/maps.interface';
import { RidesService } from '../src/modules/rides/rides.service';
import { FareService } from '../src/modules/rides/fare.service';
import { StateMachineService } from '../src/modules/rides/state-machine.service';
import type { RideType } from '@kansride/types';
import { makeDbStub } from './helpers/drizzle-mock';

const PASSENGER_USER_ID = '00000000-0000-4000-8000-000000000001';
const PASSENGER_PROFILE_ID = '00000000-0000-4000-8000-000000000002';

function buildService(db = makeDbStub()) {
  const eventsGateway = {
    emitRideUpdate: vi.fn(),
    emitToUser: vi.fn(),
    emitToDriver: vi.fn().mockResolvedValue(undefined),
  };
  const dispatchService = {
    dispatchRide: vi.fn().mockResolvedValue(undefined),
    invalidateRideOffers: vi.fn().mockResolvedValue(undefined),
  };
  const mapsProvider: IMapsProvider = {
    getDistance: vi.fn().mockResolvedValue({ distanceMeters: 5_000, durationSeconds: 600 }),
  } as unknown as IMapsProvider;
  const fareService = new FareService();
  const stateMachine = new StateMachineService();
  const service = new RidesService(
    db as unknown as Database,
    mapsProvider,
    fareService,
    stateMachine,
    dispatchService as never,
    eventsGateway as never,
  );
  return { service, db, dispatchService, eventsGateway, mapsProvider, fareService };
}

const INVALID_RIDE_TYPES: unknown[] = [
  'standard',
  'comfort',
  'luxury',
  'priority',
  '',
  'STANDARD_TRICYCLE', // case-sensitive
  'tricycle',
  'parcel_delivery_v2',
  42,
  null,
  true,
  {},
];

describe('RidesService.estimateFare — canonical estimate contract', () => {
  it('returns the shared fare breakdown for valid coordinates and ride type', async () => {
    const { service, mapsProvider } = buildService();
    const estimate = await service.estimateFare({
      pickupLatitude: 5.6,
      pickupLongitude: -0.19,
      dropoffLatitude: 5.61,
      dropoffLongitude: -0.2,
      rideType: 'priority_tricycle',
    });
    expect(estimate.rideType).toBe('priority_tricycle');
    expect(estimate.estimatedDistanceMeters).toBe(5_000);
    expect(estimate.fareBreakdown.totalFarePesewas).toBe(1_575);
    expect(mapsProvider.getDistance).toHaveBeenCalledTimes(1);
  });

  it('rejects non-finite coordinates before maps work', async () => {
    const { service, mapsProvider } = buildService();
    await expect(service.estimateFare({
      pickupLatitude: Number.NaN,
      pickupLongitude: -0.19,
      dropoffLatitude: 5.61,
      dropoffLongitude: -0.2,
    })).rejects.toThrow(/coordinates are required/);
    expect(mapsProvider.getDistance).not.toHaveBeenCalled();
  });
});

describe('RidesService.createRide — ride-type validation', () => {
  it('rejects unsupported rideType values with a 400 BadRequest and never touches maps / db', async () => {
    for (const rideType of INVALID_RIDE_TYPES) {
      const { service, db, mapsProvider } = buildService();
      await expect(
        service.createRide(PASSENGER_USER_ID, {
          pickupLatitude: 5.6,
          pickupLongitude: -0.19,
          dropoffLatitude: 5.61,
          dropoffLongitude: -0.2,
          rideType: rideType as RideType | undefined,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createRide(PASSENGER_USER_ID, {
          pickupLatitude: 5.6,
          pickupLongitude: -0.19,
          dropoffLatitude: 5.61,
          dropoffLongitude: -0.2,
          rideType: rideType as RideType | undefined,
        }),
      ).rejects.toThrow(/rideType must be one of:/);
      expect((mapsProvider as { getDistance?: unknown }).getDistance).not.toHaveBeenCalled();
      expect(db.pending()).toBe(0);
    }
  });

  it('accepts every canonical RideType and persists the same one to FareService + rides insert', async () => {
    for (const rideType of ['standard_tricycle', 'priority_tricycle', 'shared', 'parcel_delivery'] as RideType[]) {
      const { service, db, dispatchService, eventsGateway, mapsProvider } = buildService();
      const persistedFare = new FareService().calculateFare(5_000, 600, rideType).totalFarePesewas;
      db.enqueue([{ id: PASSENGER_PROFILE_ID, userId: PASSENGER_USER_ID }]); // passenger lookup
      const insertedRide = {
        id: '00000000-0000-4000-8000-000000000003',
        status: 'requested',
        rideType,
        estimatedFarePesewas: persistedFare,
        estimatedDistanceMeters: 5_000,
        estimatedDurationSeconds: 600,
        verificationPin: '1234',
        passengerId: PASSENGER_PROFILE_ID,
        pickupLatitude: '5.6',
        pickupLongitude: '-0.19',
        dropoffLatitude: '5.61',
        dropoffLongitude: '-0.2',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      db.enqueue([insertedRide]); // insert returning()
      const created = await service.createRide(PASSENGER_USER_ID, {
        pickupLatitude: 5.6,
        pickupLongitude: -0.19,
        pickupAddress: 'Accra Mall',
        dropoffLatitude: 5.61,
        dropoffLongitude: -0.2,
        dropoffAddress: 'Kotoka Airport',
        rideType,
      });
      // The maps provider was invoked once; fare was integer pesewas.
      expect((mapsProvider as { getDistance?: (a: unknown, b: unknown) => unknown }).getDistance)
        .toHaveBeenCalledTimes(1);
      expect(Number.isInteger(created.estimatedFarePesewas)).toBe(true);
      expect(created.estimatedFarePesewas).toBe(
        new FareService().calculateFare(5_000, 600, rideType).totalFarePesewas,
      );
      // Dispatch was triggered exactly once for the persisted ride.
      expect(dispatchService.dispatchRide).toHaveBeenCalledTimes(1);
      expect(dispatchService.dispatchRide).toHaveBeenCalledWith(
        insertedRide.id,
        -0.19,
        5.6,
      );
      // The ride was emitted ONLY to the authenticated passenger's sockets as
      // a `ride:update`, never to the ride room (no room subscribers exist yet).
      expect(eventsGateway.emitToUser).toHaveBeenCalledTimes(1);
      expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
        PASSENGER_USER_ID,
        'ride:update',
        expect.objectContaining({ status: 'requested', rideId: insertedRide.id }),
      );
      expect(eventsGateway.emitRideUpdate).not.toHaveBeenCalled();
    }
  });

  it('defaults an omitted rideType to standard_tricycle and charges the standard fare', async () => {
    const { service, db } = buildService();
    db.enqueue([{ id: PASSENGER_PROFILE_ID, userId: PASSENGER_USER_ID }]); // passenger
    db.enqueue([{ // insert returning()
      id: '00000000-0000-4000-8000-000000000004',
      status: 'requested',
      rideType: 'standard_tricycle',
      estimatedFarePesewas: new FareService().calculateFare(5_000, 600, 'standard_tricycle').totalFarePesewas,
      estimatedDistanceMeters: 5_000,
      estimatedDurationSeconds: 600,
      verificationPin: '1234',
      passengerId: PASSENGER_PROFILE_ID,
      pickupLatitude: '5.6',
      pickupLongitude: '-0.19',
      dropoffLatitude: '5.61',
      dropoffLongitude: '-0.2',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }]);
    const created = await service.createRide(PASSENGER_USER_ID, {
      pickupLatitude: 5.6,
      pickupLongitude: -0.19,
      dropoffLatitude: 5.61,
      dropoffLongitude: -0.2,
      // rideType intentionally omitted
    });
    expect(created.rideType).toBe('standard_tricycle');
    expect(created.estimatedFarePesewas).toBe(
      new FareService().calculateFare(5_000, 600, 'standard_tricycle').totalFarePesewas,
    );
    db.assertDrained();
  });
});