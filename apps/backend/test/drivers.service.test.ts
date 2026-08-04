import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@kansride/db';
import { DriversService } from '../src/modules/drivers/drivers.service';
import { makeDbStub } from './helpers/drizzle-mock';
import type { IRedisService } from '../src/redis/redis.interface';
import type { IPaymentProvider } from '../src/providers/payments/payment.interface';

const DRIVER_ID = '00000000-0000-4000-8000-000000000020';
const USER_ID = '00000000-0000-4000-8000-000000000021';
const PAYMENT_ID = '00000000-0000-4000-8000-000000000022';
const SUBSCRIPTION_ID = '00000000-0000-4000-8000-000000000023';

function buildService(
  db = makeDbStub(),
  paymentProvider: IPaymentProvider = {
    initiate: vi.fn().mockResolvedValue({ reference: 'provider-1', status: 'success' }),
    verify: vi.fn(),
  },
) {
  const redis = {
    geoAdd: vi.fn(),
    geoRemove: vi.fn(),
    geoSearch: vi.fn(),
  } as unknown as IRedisService;
  return {
    service: new DriversService(db as unknown as Database, redis, paymentProvider),
    db,
    paymentProvider,
    redis,
  };
}

describe('DriversService.subscribe payment lifecycle', () => {
  it('rejects unsupported payment methods before database or provider work', async () => {
    const { service, db, paymentProvider } = buildService();

    await expect(service.subscribe(DRIVER_ID, 'unsupported')).rejects.toThrow(
      /paymentMethod must be one of/,
    );
    expect(paymentProvider.initiate).not.toHaveBeenCalled();
    expect(db.pending()).toBe(0);
  });

  it('persists a successful payment, links the subscription, and activates the driver atomically', async () => {
    const { service, db } = buildService();
    db.enqueue([{ id: DRIVER_ID, userId: USER_ID }]);
    db.enqueue([{ id: USER_ID, phoneNumber: '+233501234567' }]);
    db.enqueue([]);
    db.enqueue([{ id: PAYMENT_ID }]);
    db.enqueue([{ id: SUBSCRIPTION_ID }]);
    db.enqueue([]);
    db.enqueue([]);

    const result = await service.subscribe(DRIVER_ID, 'mtn_mobile_money');

    expect(result).toMatchObject({
      message: 'Subscription activated',
      reference: 'provider-1',
      subscriptionId: SUBSCRIPTION_ID,
    });
    db.assertDrained();
  });

  it('persists pending provider results without activating the driver', async () => {
    const paymentProvider: IPaymentProvider = {
      initiate: vi.fn().mockResolvedValue({ reference: 'provider-pending', status: 'pending' }),
      verify: vi.fn(),
    };
    const { service, db } = buildService(makeDbStub(), paymentProvider);
    db.enqueue([{ id: DRIVER_ID, userId: USER_ID }]);
    db.enqueue([{ id: USER_ID, phoneNumber: '+233501234567' }]);
    db.enqueue([]);
    db.enqueue([{ id: PAYMENT_ID }]);
    db.enqueue([{ id: SUBSCRIPTION_ID }]);
    db.enqueue([]);

    await expect(service.subscribe(DRIVER_ID, 'telecel_cash')).resolves.toMatchObject({
      message: 'Payment pending',
      status: 'pending',
      subscriptionId: SUBSCRIPTION_ID,
    });
    db.assertDrained();
  });

  it('returns the existing payment result for a duplicate provider reference', async () => {
    const { service, db } = buildService();
    db.enqueue([{ id: DRIVER_ID, userId: USER_ID }]);
    db.enqueue([{ id: USER_ID, phoneNumber: '+233501234567' }]);
    db.enqueue([{ id: PAYMENT_ID, status: 'successful' }]);

    await expect(service.subscribe(DRIVER_ID, 'at_money')).resolves.toEqual({
      message: 'Payment already recorded',
      reference: 'provider-1',
      status: 'successful',
    });
    db.assertDrained();
  });
});
