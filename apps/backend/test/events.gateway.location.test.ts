import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.PAYMENT_PROVIDER = 'mock';
});
import type { Database } from '@kansride/db';
import { EventsGateway } from '../src/modules/events/events.gateway';
import { makeDbStub } from './helpers/drizzle-mock';
import { ACTIVE_RIDE_LOCATION_STATUSES } from '@kansride/config';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const DRIVER_ID = '00000000-0000-4000-8000-000000000002';

function buildGateway(db = makeDbStub(), eligible = true, activeRide = false) {
  const redis = {
    geoAdd: vi.fn().mockResolvedValue(undefined),
    geoRemove: vi.fn().mockResolvedValue(undefined),
  };
  const dispatch = {
    isDriverLocationEligible: vi.fn().mockImplementation(async (_id: string, allowActiveRide = false) =>
      allowActiveRide ? eligible : eligible && !activeRide,
    ),
  };
  const publicTracking = { emitDriverLocation: vi.fn().mockResolvedValue(undefined) };
  const gateway = new EventsGateway(
    db as unknown as Database,
    redis as never,
    dispatch as never,
    publicTracking as never,
  );
  gateway.server = {
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
  } as never;
  return { gateway, db, redis, dispatch, publicTracking };
}

function client() {
  return { data: { userId: USER_ID, role: 'driver', phoneNumber: '+233200000001' } } as never;
}

describe('EventsGateway driver location eligibility', () => {
  it('uses canonical live-location statuses for passenger delivery', () => {
    expect(ACTIVE_RIDE_LOCATION_STATUSES).toEqual([
      'driver_assigned',
      'driver_en_route',
      'driver_arrived',
      'waiting_for_passenger',
      'passenger_verified',
      'in_progress',
      'emergency_hold',
    ]);
  });

  it('rejects invalid coordinates before Redis or database writes', async () => {
    const { gateway, db, redis } = buildGateway();
    db.enqueue([{ id: DRIVER_ID }]);

    const result = await gateway.handleDriverLocation(client(), { latitude: 91, longitude: 0 });

    expect(result).toMatchObject({ event: 'error' });
    expect(redis.geoAdd).not.toHaveBeenCalled();
    expect(db.pending()).toBe(0);
  });

  it('removes ineligible drivers from availability and does not re-add them', async () => {
    const { gateway, db, redis, dispatch } = buildGateway(makeDbStub(), false);
    db.enqueue([{ id: DRIVER_ID }]);
    db.enqueue([]);

    const result = await gateway.handleDriverLocation(client(), { latitude: 5.603, longitude: -0.187 });

    expect(result).toMatchObject({ event: 'error' });
    expect(dispatch.isDriverLocationEligible).toHaveBeenCalledWith(DRIVER_ID, true, false);
    expect(redis.geoAdd).not.toHaveBeenCalled();
    expect(redis.geoRemove).toHaveBeenCalledWith('drivers:online:locations', DRIVER_ID);
  });

  it('keeps eligible active-ride drivers deliverable without retaining availability', async () => {
    const { gateway, db, redis, dispatch } = buildGateway(makeDbStub(), true, true);
    db.enqueue([{ id: DRIVER_ID }]);
    db.enqueue([]);
    db.enqueue([{ id: '00000000-0000-0000-0000-000000000003' }]);

    const result = await gateway.handleDriverLocation(client(), { latitude: 5.603, longitude: -0.187 });

    expect(result).toMatchObject({ event: 'ack', data: { received: true } });
    expect(dispatch.isDriverLocationEligible).toHaveBeenNthCalledWith(1, DRIVER_ID, true, false);
    expect(dispatch.isDriverLocationEligible).toHaveBeenNthCalledWith(2, DRIVER_ID, false, true);
    expect(redis.geoAdd).not.toHaveBeenCalled();
    expect(redis.geoRemove).toHaveBeenCalledWith('drivers:online:locations', DRIVER_ID);
  });
});
