import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@kansride/db';
import { DriversService } from '../src/modules/drivers/drivers.service';
import { makeDbStub } from './helpers/drizzle-mock';
import type { IRedisService } from '../src/redis/redis.interface';
import type { IPaymentProvider } from '../src/providers/payments/payment.interface';
import {
  DisabledPaymentProvider,
  PAYMENTS_TEMPORARILY_UNAVAILABLE_MESSAGE,
} from '../src/providers/payments/disabled-payment.provider';

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

describe('manual driver approval', () => {
  const application = {
    phoneNumber: '0501234567', firstName: 'Kofi', lastName: 'Mensah',
    ghanaCardNumber: 'GHA-123456789-0', vehicleRegistration: 'WR-123-26',
    vehicleColour: 'Teal', vehicleMake: 'Bajaj', vehicleModel: 'RE',
    placeOfStay: 'Kansaworodo', communityId: 'kansaworodo',
    driverPhoto: 'data:image/jpeg;base64,YQ==', emergencyContactName: 'Ama',
    emergencyPhoneNumber: '0241234567', pin: '0123',
  };
  it('creates a public application without OTP or issuing login tokens', async () => {
    const { service, db } = buildService();
    db.enqueue([{ id: USER_ID }]); db.enqueue([{ role: 'driver_applicant' }]); db.enqueue([]);
    db.enqueue([{ id: 'vehicle-1' }]); db.enqueue([{ id: DRIVER_ID }]); db.enqueue([]);
    const result = await service.register(undefined, application);
    expect(result).toEqual({ message: 'Registration submitted for review', driverId: DRIVER_ID, status: 'pending' });
    expect(result).not.toHaveProperty('accessToken'); db.assertDrained();
  });
  it('cannot replace an existing account through a public application', async () => {
    const { service, db } = buildService(); db.enqueue([]);
    await expect(service.register(undefined, application)).rejects.toThrow('An account already uses this number');
    db.assertDrained();
  });
  it('blocks a pending driver from going online even in free-launch mode', async () => {
    const { service, db, redis } = buildService(); db.enqueue([{ id: DRIVER_ID, userId: USER_ID, isActive: false }]);
    await expect(service.setOnlineStatus(DRIVER_ID, true, { latitude: 4.962, longitude: -1.7693 })).rejects.toThrow('Admin approval');
    expect(redis.geoAdd).not.toHaveBeenCalled(); db.assertDrained();
  });
});

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

  it('returns a controlled unavailable response without writing payment state when payments are disabled', async () => {
    const { service, db } = buildService(
      makeDbStub(),
      new DisabledPaymentProvider(),
    );
    const transaction = vi.spyOn(db, 'transaction');
    db.enqueue([{ id: DRIVER_ID, userId: USER_ID }]);
    db.enqueue([{ id: USER_ID, phoneNumber: '+233501234567' }]);

    await expect(
      service.subscribe(DRIVER_ID, 'mtn_mobile_money'),
    ).rejects.toMatchObject({
      status: 503,
      response: {
        statusCode: 503,
        message: PAYMENTS_TEMPORARILY_UNAVAILABLE_MESSAGE,
      },
    });
    expect(transaction).not.toHaveBeenCalled();
    db.assertDrained();
  });

  it('keeps a pre-provisioned active pilot subscription usable when payments are disabled', async () => {
    vi.stubEnv('DRIVER_ACCESS_MODE', 'subscription');
    const { service, db, redis } = buildService(
      makeDbStub(),
      new DisabledPaymentProvider(),
    );
    db.enqueue([{ id: DRIVER_ID, userId: USER_ID, isActive: true }]);
    db.enqueue([{ id: USER_ID, role: 'driver', status: 'active', isVerified: true }]);
    db.enqueue([{ id: SUBSCRIPTION_ID, driverId: DRIVER_ID, status: 'active' }]);
    db.enqueue([]);

    await expect(
      service.setOnlineStatus(DRIVER_ID, true, {
        latitude: 5.603,
        longitude: -0.187,
      }),
    ).resolves.toMatchObject({ driverId: DRIVER_ID, online: true });
    expect(redis.geoAdd).toHaveBeenCalledWith(
      'drivers:online:locations',
      -0.187,
      5.603,
      DRIVER_ID,
    );
    db.assertDrained();
    vi.unstubAllEnvs();
  });

  it('allows an approved driver online without consuming payment state during free launch', async () => {
    vi.stubEnv('DRIVER_ACCESS_MODE', 'free_launch');
    const { service, db, redis, paymentProvider } = buildService();
    db.enqueue([{ id: DRIVER_ID, userId: USER_ID, isActive: true }]);
    db.enqueue([{ id: USER_ID, role: 'driver', status: 'active', isVerified: true }]);
    db.enqueue([]);
    await expect(service.setOnlineStatus(DRIVER_ID, true, { latitude: 4.962, longitude: -1.7693 }))
      .resolves.toMatchObject({ driverId: DRIVER_ID, online: true });
    expect(paymentProvider.initiate).not.toHaveBeenCalled();
    expect(redis.geoAdd).toHaveBeenCalled();
    db.assertDrained();
    vi.unstubAllEnvs();
  });
});
