import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@kansride/db';
import { DispatchService } from '../src/modules/rides/dispatch.service';
import { MemoryRedisService } from '../src/redis/memory-redis.service';
import { makeDbStub } from './helpers/drizzle-mock';

afterEach(() => vi.useRealTimers());
const ride = {
  id: 'ride-1', status: 'no_driver_found', rideType: 'standard_tricycle', driverId: null,
  estimatedFarePesewas: 500, actualFarePesewas: null, createdAt: new Date(), updatedAt: new Date(),
};
function setup() {
  const db = makeDbStub();
  const redis = new MemoryRedisService();
  const events = { emitRideUpdate: vi.fn(), emitToUser: vi.fn() };
  const dispatch = new DispatchService(db as unknown as Database, redis, events as never);
  return { db, redis, events, dispatch };
}

describe('dispatch recovery', () => {
  it('expires only searches whose stale unassigned state is still current', async () => {
    const { db, dispatch, events } = setup();
    db.enqueue([{ id: ride.id }]); db.enqueue([ride]);
    await dispatch.expireInterruptedSearches();
    expect(events.emitRideUpdate).toHaveBeenCalledWith(ride.id, expect.objectContaining({ status: 'no_driver_found' }));
    db.assertDrained();
  });
  it('does not emit if acceptance or cancellation wins the conditional update', async () => {
    const { db, dispatch, events } = setup();
    db.enqueue([{ id: ride.id }]); db.enqueue([]);
    await dispatch.expireInterruptedSearches();
    expect(events.emitRideUpdate).not.toHaveBeenCalled();
    db.assertDrained();
  });
  it('recovers again after a temporary database failure', async () => {
    const { db, dispatch } = setup();
    db.enqueueFn(() => { throw new Error('offline'); });
    await expect(dispatch.expireInterruptedSearches()).resolves.toBeUndefined();
    db.enqueue([]);
    await dispatch.expireInterruptedSearches();
    db.assertDrained();
  });
  it('contains timer errors and clears pending timers during shutdown', async () => {
    vi.useFakeTimers();
    const { db, dispatch } = setup();
    db.enqueue([{ ...ride, status: 'searching' }]);
    await dispatch.dispatchRide(ride.id, -1.77, 4.96);
    db.enqueueFn(() => { throw new Error('offline'); });
    db.enqueueFn(() => { throw new Error('offline'); });
    await vi.advanceTimersByTimeAsync(30000);
    dispatch.onModuleDestroy();
    expect(vi.getTimerCount()).toBe(0);
    db.assertDrained();
  });
});

describe('single active driver assignment', () => {
  async function offerSetup() {
    const state = setup();
    await state.redis.set('ride:offer:ride-1:driver-1', JSON.stringify({
      rideId: 'ride-1', driverId: 'driver-1', expiresAt: new Date(Date.now() + 30000).toISOString(),
    }), 30);
    state.db.enqueue([{ driverId: 'driver-1', userId: 'user-1', firstName: 'Test', lastName: null, rating: '5.00' }]);
    state.db.enqueue([{ id: 'subscription-1' }]);
    state.db.enqueue([]);
    return state;
  }
  it('returns a controlled refusal if another ride claims the driver concurrently', async () => {
    const { db, dispatch } = await offerSetup();
    db.enqueueFn(() => { throw { code: '23505', constraint: 'idx_rides_one_active_driver' }; });
    expect(await dispatch.driverAcceptRide('ride-1', 'driver-1')).toMatchObject({ success: false, message: expect.stringContaining('active ride') });
    db.assertDrained();
  });
  it('still confirms a committed assignment when Redis cleanup fails', async () => {
    const { db, redis, dispatch } = await offerSetup();
    db.enqueue([{ ...ride, driverId: 'driver-1', status: 'driver_assigned' }]);
    vi.spyOn(redis, 'sMembers').mockRejectedValue(new Error('offline'));
    expect(await dispatch.driverAcceptRide('ride-1', 'driver-1')).toMatchObject({ success: true, update: { status: 'driver_assigned' } });
    db.assertDrained();
  });
});
