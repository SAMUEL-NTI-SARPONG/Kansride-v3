import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@kansride/db';
import { makeDbStub } from './helpers/drizzle-mock';
import { TextBeeSMSProvider } from '../src/providers/sms/textbee-sms.provider';

afterEach(() => vi.unstubAllGlobals());

describe('TextBeeSMSProvider', () => {
  it('sends an OTP using the configured device and SIM without exposing the key in the body', async () => {
    const db = makeDbStub();
    db.enqueue([{ value: { enabled: true, deviceId: 'device-1', simSubscriptionId: 7, sendingPhoneLabel: '+233 54 698 8890' } }]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { success: true, smsBatchId: 'batch-1' } }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(new TextBeeSMSProvider(db as unknown as Database, 'secret-key').sendOTP('+233501234567', '123456')).resolves.toEqual({ success: true, messageId: 'batch-1' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.textbee.dev/api/v1/gateway/send-sms', expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'secret-key' }) }));
    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual(expect.objectContaining({ recipients: ['+233501234567'], deviceId: 'device-1', simSubscriptionId: 7 }));
    expect(request.body).not.toContain('secret-key');
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports gateway rejection and timeout as failure, never simulated delivery', async () => {
    for (const respond of [async () => ({ ok: false, status: 429, json: async () => ({}) }), async () => { throw new Error('Timed out'); }]) {
      const db = makeDbStub(); db.enqueue([]);
      vi.stubGlobal('fetch', vi.fn(respond));
      await expect(new TextBeeSMSProvider(db as unknown as Database, 'secret-key').sendOTP('+233501234567', '123456')).resolves.toEqual({ success: false, messageId: undefined });
    }
  });

  it('refuses to send when an administrator disables OTP SMS', async () => {
    const db = makeDbStub(); db.enqueue([{ value: { enabled: false } }]);
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(new TextBeeSMSProvider(db as unknown as Database, 'secret-key').sendOTP('+233501234567', '123456')).resolves.toEqual({ success: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
