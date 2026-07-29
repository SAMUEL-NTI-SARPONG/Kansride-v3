import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { Database } from '@kansride/db';
import type { IMapsProvider } from '../src/providers/maps/maps.interface';
import { RidesService } from '../src/modules/rides/rides.service';
import { FareService } from '../src/modules/rides/fare.service';
import { StateMachineService } from '../src/modules/rides/state-machine.service';
import type { UserRole } from '@kansride/types';
import { makeDbStub } from './helpers/drizzle-mock';

const RIDE_ID = '00000000-0000-4000-8000-000000000010';
const PASSENGER_USER_ID = '00000000-0000-4000-8000-000000000001';

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
  const service = new RidesService(
    db as unknown as Database,
    mapsProvider,
    new FareService(),
    new StateMachineService(),
    dispatchService as never,
    eventsGateway as never,
  );
  return { service, db };
}

function makeRideRow(): Record<string, unknown> {
  return {
    id: RIDE_ID,
    status: 'driver_assigned',
    passengerId: '00000000-0000-4000-8000-000000000002',
    driverId: '00000000-0000-4000-8000-000000000003',
    verificationPin: '1234',
    estimatedFarePesewas: 1050,
  };
}

describe('RidesService.getRideForActor — ride:view_all staff access (E1)', () => {
  it('admits a role carrying ride:view_all (dispatcher) and strips the verification PIN', async () => {
    const { service, db } = buildService();
    db.enqueue([makeRideRow()]); // getRide
    const ride = await service.getRideForActor(RIDE_ID, PASSENGER_USER_ID, 'dispatcher' as UserRole);
    expect(ride).toMatchObject({ id: RIDE_ID, status: 'driver_assigned' });
    // Staff review does not need the passenger/driver pickup handshake PIN.
    expect((ride as Record<string, unknown>).verificationPin).toBeUndefined();
    db.assertDrained();
  });

  it('admits auditor (ride:view_all) and strips the verification PIN', async () => {
    const { service, db } = buildService();
    db.enqueue([makeRideRow()]);
    const ride = await service.getRideForActor(RIDE_ID, PASSENGER_USER_ID, 'auditor' as UserRole);
    expect((ride as Record<string, unknown>).verificationPin).toBeUndefined();
    db.assertDrained();
  });

  it('super_admin still receives the full ride including the verification PIN', async () => {
    const { service, db } = buildService();
    db.enqueue([makeRideRow()]);
    const ride = await service.getRideForActor(RIDE_ID, PASSENGER_USER_ID, 'super_admin' as UserRole);
    expect((ride as Record<string, unknown>).verificationPin).toBe('1234');
    db.assertDrained();
  });

  it('rejects a role that lacks ride:view_all and is not an owner (finance_officer)', async () => {
    const { service, db } = buildService();
    db.enqueue([makeRideRow()]); // getRide runs before the role branch
    await expect(
      service.getRideForActor(RIDE_ID, PASSENGER_USER_ID, 'finance_officer' as UserRole),
    ).rejects.toThrow(ForbiddenException);
    db.assertDrained();
  });
});