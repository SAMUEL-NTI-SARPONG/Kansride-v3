import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { Database } from '@kansride/db';
import type { IMapsProvider } from '../src/providers/maps/maps.interface';
import { RidesService } from '../src/modules/rides/rides.service';
import { FareService } from '../src/modules/rides/fare.service';
import { StateMachineService } from '../src/modules/rides/state-machine.service';
import type { RideStatus, UserRole } from '@kansride/types';
import { makeDbStub } from './helpers/drizzle-mock';

const RIDE_ID = '00000000-0000-4000-8000-000000000001';
const PASSENGER_USER_ID = '00000000-0000-4000-8000-000000000002';
const OTHER_PASSENGER_USER_ID = '00000000-0000-4000-8000-000000000003';
const PASSENGER_PROFILE_ID = '00000000-0000-4000-8000-000000000004';
const DRIVER_ID = '00000000-0000-4000-8000-000000000005';

interface DbShape {
  select(..._: unknown[]): unknown;
  insert(..._: unknown[]): unknown;
  update(..._: unknown[]): unknown;
  transaction<R>(fn: (tx: unknown) => Promise<R>): Promise<R>;
}

/** `db` stub whose every method throws — used to prove a code path that the
 *  service must reject before any database call. */
function unreachableDb(): DbShape {
  const fail = (label: string): never => {
    throw new Error(`db.${label} must not be called on this rateRide path`);
  };
  return {
    select: () => fail('select'),
    insert: () => fail('insert'),
    update: () => fail('update'),
    transaction: async () => fail('transaction'),
  };
}

function rideRow(overrides: Partial<{
  status: RideStatus;
  passengerId: string;
  driverId: string | null;
  ratedBy: string | null;
}> = {}): Record<string, unknown> {
  return {
    id: RIDE_ID,
    passengerId: overrides.passengerId ?? PASSENGER_PROFILE_ID,
    driverId: overrides.driverId === undefined ? DRIVER_ID : overrides.driverId,
    verificationPin: '1234',
    status: overrides.status ?? 'completed',
    ratedBy: overrides.ratedBy ?? null,
    rating: null,
    ratingComment: null,
    ratedAt: null,
    actualFarePesewas: 600,
    estimatedFarePesewas: 600,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function passengerRow(id = PASSENGER_PROFILE_ID, userId = PASSENGER_USER_ID) {
  return { id, userId };
}

function buildService(db: DbShape = unreachableDb()) {
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
  return { service, db, dispatchService, eventsGateway, mapsProvider, fareService, stateMachine };
}

describe('RidesService.rateRide — input validation (no DB access allowed)', () => {
  it('rejects fractional, zero, negative, and out-of-range ratings before any DB access', async () => {
    const invalids = [0, 1.5, -1, 6, 10, NaN];
    for (const rating of invalids) {
      const { service } = buildService(); // unreachable db
      await expect(
        service.rateRide(RIDE_ID, PASSENGER_USER_ID, 'passenger', rating, undefined),
      ).rejects.toThrow(BadRequestException);
    }
  });
});

describe('RidesService.rateRide — role gating', () => {
  it('rejects ratings from non-passenger roles even on a completed ride (ForbiddenException)', async () => {
    const nonPassengerRoles: UserRole[] = [
      'driver',
      'driver_applicant',
      'dispatcher',
      'support_agent',
      'finance_officer',
      'safety_officer',
      'ops_admin',
      'system_admin',
      'super_admin',
      'auditor',
    ];
    for (const role of nonPassengerRoles) {
      const stub = makeDbStub();
      const { service } = buildService(stub);
      stub.enqueue([rideRow({ status: 'completed', ratedBy: null })]);
      await expect(
        service.rateRide(RIDE_ID, PASSENGER_USER_ID, role, 4, undefined),
      ).rejects.toThrow(ForbiddenException);
      // rateRide matched the ride, but stopped before resolving passenger.id
      // (no passenger lookup or transaction body ran).
      stub.assertDrained();
    }
  });
});

describe('RidesService.rateRide — ride-state and ownership pre-checks', () => {
  it('rejects rating a ride that is not in the completed status', async () => {
    const nonCompleted: RideStatus[] = [
      'requested',
      'searching',
      'driver_offered',
      'driver_assigned',
      'driver_en_route',
      'driver_arrived',
      'waiting_for_passenger',
      'passenger_verified',
      'in_progress',
      'cancelled_by_passenger',
      'no_driver_found',
    ];
    for (const status of nonCompleted) {
      const stub = makeDbStub();
      const { service } = buildService(stub);
      stub.enqueue([rideRow({ status, ratedBy: null })]);
      await expect(
        service.rateRide(RIDE_ID, PASSENGER_USER_ID, 'passenger', 4, undefined),
      ).rejects.toThrow(BadRequestException);
      stub.assertDrained();
    }
  });

  it('rejects a passenger that does not own the ride', async () => {
    const stub = makeDbStub();
    const { service } = buildService(stub);
    stub.enqueue([rideRow({ status: 'completed', ratedBy: null })]);
    const otherProfileId = '00000000-0000-4000-8000-000000000099';
    stub.enqueue([passengerRow(otherProfileId, OTHER_PASSENGER_USER_ID)]);
    await expect(
      service.rateRide(RIDE_ID, OTHER_PASSENGER_USER_ID, 'passenger', 4, undefined),
    ).rejects.toThrow(ForbiddenException);
    stub.assertDrained();
  });

  it('short-circuits with a friendly ConflictException when ratedBy is already set', async () => {
    const stub = makeDbStub();
    const { service } = buildService(stub);
    stub.enqueue([rideRow({ status: 'completed', ratedBy: PASSENGER_USER_ID })]);
    stub.enqueue([passengerRow()]); // passenger lookup runs before the pre-check
    await expect(
      service.rateRide(RIDE_ID, PASSENGER_USER_ID, 'passenger', 4, undefined),
    ).rejects.toThrow(ConflictException);
    stub.assertDrained();
  });
});

describe('RidesService.rateRide — race protection by conditional UPDATE', () => {
  it('commits rating + driver AVG recompute when the conditional UPDATE wins the race', async () => {
    const stub = makeDbStub();
    const { service } = buildService(stub);
    stub.enqueue([rideRow({ status: 'completed', ratedBy: null })]); // getRide
    stub.enqueue([passengerRow()]); // getPassengerProfileByUserId
    stub.enqueue([{ id: RIDE_ID }]); // tx.update(...).returning() -> 1 row (winner)
    stub.enqueue([{ value: '4.50' }]); // tx.select(avg) -> recompute
    stub.enqueue([{ id: DRIVER_ID }]); // tx.update(drivers).where() -> promise awaits
    const result = await service.rateRide(RIDE_ID, PASSENGER_USER_ID, 'passenger', 4, 'good');
    expect(result).toEqual({ id: RIDE_ID, rating: 4, comment: 'good' });
    stub.assertDrained();
  });

  it('throws ConflictException when the conditional UPDATE returns zero rows (concurrent loser)', async () => {
    const stub = makeDbStub();
    const { service } = buildService(stub);
    stub.enqueue([rideRow({ status: 'completed', ratedBy: null })]); // getRide
    stub.enqueue([passengerRow()]); // getPassengerProfileByUserId
    stub.enqueue([]); // tx.update(...).returning() -> 0 rows -> race loser
    await expect(
      service.rateRide(RIDE_ID, PASSENGER_USER_ID, 'passenger', 4, undefined),
    ).rejects.toThrow(ConflictException);
    // No driver AVG recompute ran (the queue should be drained after 3 entries).
    stub.assertDrained();
  });
});

describe('RidesService.rateRide — transaction recompute path', () => {
  // If `driverId` is null on the completed ride (defensive: an admin completed
  // a ride for accounting purposes etc.), the AVG driver-rating recompute is
  // skipped, and the rating commit still succeeds for the requesting passenger.
  it('commits a rating for an unassigned completed ride without touching drivers', async () => {
    const stub = makeDbStub();
    const { service } = buildService(stub);
    stub.enqueue([rideRow({ status: 'completed', ratedBy: null, driverId: null })]);
    stub.enqueue([passengerRow()]);
    stub.enqueue([{ id: RIDE_ID }]); // tx.update(...).returning() -> 1 row (winner)
    const result = await service.rateRide(RIDE_ID, PASSENGER_USER_ID, 'passenger', 5, undefined);
    expect(result).toEqual({ id: RIDE_ID, rating: 5, comment: undefined });
    stub.assertDrained();
  });
});