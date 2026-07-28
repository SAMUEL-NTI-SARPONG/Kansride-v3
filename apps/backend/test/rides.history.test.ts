import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { Database } from '@kansride/db';
import type { IMapsProvider } from '../src/providers/maps/maps.interface';
import { RidesService } from '../src/modules/rides/rides.service';
import { FareService } from '../src/modules/rides/fare.service';
import { StateMachineService } from '../src/modules/rides/state-machine.service';
import type { UserRole } from '@kansride/types';
import { makeDbStub } from './helpers/drizzle-mock';

const PASSENGER_USER_ID = '00000000-0000-4000-8000-000000000001';
const PASSENGER_PROFILE_ID = '00000000-0000-4000-8000-000000000002';
const DRIVER_USER_ID = '00000000-0000-4000-8000-000000000003';
const DRIVER_PROFILE_ID = '00000000-0000-4000-8000-000000000004';
const FORBIDDEN_ROLE: UserRole[] = [
  'dispatcher',
  'support_agent',
  'finance_officer',
  'safety_officer',
  'ops_admin',
  'system_admin',
  'super_admin',
  'auditor',
  'driver_applicant',
];

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
  return { service, db };
}

function makeRideRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: overrides['id'] ?? '00000000-0000-4000-8000-000000000010',
    pickupAddress: overrides['pickupAddress'] ?? 'Accra Mall',
    dropoffAddress: overrides['dropoffAddress'] ?? 'Kotoka Airport',
    pickupLatitude: overrides['pickupLatitude'] ?? '5.60500000',
    pickupLongitude: overrides['pickupLongitude'] ?? '-0.18700000',
    dropoffLatitude: overrides['dropoffLatitude'] ?? '5.60500000',
    dropoffLongitude: overrides['dropoffLongitude'] ?? '-0.18700000',
    actualFarePesewas: overrides['actualFarePesewas'] ?? null,
    estimatedFarePesewas: overrides['estimatedFarePesewas'] ?? 1050,
    status: overrides['status'] ?? 'completed',
    createdAt: overrides['createdAt'] ?? new Date('2026-07-01T10:00:00Z'),
    rideType: overrides['rideType'] ?? 'standard_tricycle',
  };
}

describe('RidesService.getRideHistory — access control', () => {
  it('refuses roles without a personal ride-history lane', async () => {
    for (const role of FORBIDDEN_ROLE) {
      const db = makeDbStub();
      const { service } = buildService(db);
      await expect(
        service.getRideHistory(PASSENGER_USER_ID, role, { limit: 20, offset: 0 }),
      ).rejects.toThrow(ForbiddenException);
      // No DB lookup should be attempted by an unauthorized role.
      expect(db.pending()).toBe(0);
    }
  });
});

describe('RidesService.getRideHistory — passenger history', () => {
  it('resolves passenger.id from JWT userId, never trusts a caller-supplied id', async () => {
    const db = makeDbStub();
    const { service } = buildService(db);
    db.enqueue([{ id: PASSENGER_PROFILE_ID, userId: PASSENGER_USER_ID }]); // passenger lookup
    db.enqueue([
      makeRideRow({
        id: '00000000-0000-4000-8000-000000000020',
        actualFarePesewas: 1500,
        estimatedFarePesewas: 1050,
        status: 'completed',
        createdAt: new Date('2026-07-01T10:00:00Z'),
      }),
      makeRideRow({
        id: '00000000-0000-4000-8000-000000000021',
        actualFarePesewas: null,
        estimatedFarePesewas: 600,
        status: 'cancelled_by_passenger',
        createdAt: new Date('2026-07-02T10:00:00Z'),
      }),
    ]);
    const history = await service.getRideHistory(PASSENGER_USER_ID, 'passenger', {
      limit: 20,
      offset: 0,
    });
    expect(history).toHaveLength(2);
    db.assertDrained();
    // Output preserves names + integer-pesewa currency units.
    expect(history[0]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000020',
      farePesewas: 1500, // actual takes precedence when present
      status: 'completed',
      pickupLatitude: 5.605, // numeric conversion from numeric-column string
    });
    expect(history[1]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000021',
      farePesewas: 600, // falls back to estimated when actual is null
      status: 'cancelled_by_passenger',
    });
  });

  it('refuses a passenger that has no profile row (ForbiddenException)', async () => {
    const db = makeDbStub();
    const { service } = buildService(db);
    db.enqueue([]); // passenger lookup returns empty
    await expect(
      service.getRideHistory(PASSENGER_USER_ID, 'passenger', { limit: 20, offset: 0 }),
    ).rejects.toThrow(ForbiddenException);
    db.assertDrained();
  });
});

describe('RidesService.getRideHistory — driver history', () => {
  it('resolves driver.id from JWT userId, never trusts a caller-supplied id', async () => {
    const db = makeDbStub();
    const { service } = buildService(db);
    db.enqueue([{ id: DRIVER_PROFILE_ID, userId: DRIVER_USER_ID }]); // driver lookup (NotFound if missing)
    db.enqueue([makeRideRow({ status: 'completed' })]);
    const history = await service.getRideHistory(DRIVER_USER_ID, 'driver', { limit: 5, offset: 0 });
    expect(history).toHaveLength(1);
    db.assertDrained();
  });

  it('refuses a driver that has no profile row (NotFoundException)', async () => {
    const db = makeDbStub();
    const { service } = buildService(db);
    db.enqueue([]); // driver lookup returns empty
    await expect(
      service.getRideHistory(DRIVER_USER_ID, 'driver', { limit: 5, offset: 0 }),
    ).rejects.toThrow(/No driver profile found for this account/);
    db.assertDrained();
  });
});