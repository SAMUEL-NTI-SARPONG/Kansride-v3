import { describe, expect, it } from 'vitest';
import { MockSMSProvider } from '../src/providers/sms/mock-sms.provider';
import { MockPaymentProvider } from '../src/providers/payments/mock-payment.provider';
import { HaversineMapsProvider } from '../src/providers/maps/haversine-maps.provider';

describe('provider contracts', () => {
  it('mock SMS returns a deterministic successful delivery shape', async () => {
    const result = await new MockSMSProvider().sendOTP('+233200000001', '123456');
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^mock-/);
  });

  it('mock payments can initiate and verify a successful payment', async () => {
    const provider = new MockPaymentProvider();
    const initiated = await provider.initiate(1000, 'mtn_mobile_money', '+233200000002', 'demo');
    expect(initiated.status).toBe('success');
    await expect(provider.verify(initiated.reference)).resolves.toMatchObject({
      reference: initiated.reference,
      status: 'success',
      amountPesewas: 1000,
    });
  });

  it('Haversine maps returns finite integer distance and duration', async () => {
    const result = await new HaversineMapsProvider().getDistance(
      { latitude: 5.603, longitude: -0.187 },
      { latitude: 5.61, longitude: -0.19 },
    );
    expect(Number.isInteger(result.distanceMeters)).toBe(true);
    expect(Number.isInteger(result.durationSeconds)).toBe(true);
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.durationSeconds).toBeGreaterThan(0);
  });
});
