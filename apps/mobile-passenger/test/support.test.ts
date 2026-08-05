import { describe, expect, it } from 'vitest';
import { supportAvailability, supportLink } from '../src/support';

describe('passenger support links', () => {
  it('constructs validated phone, WhatsApp and email links', () => {
    expect(supportLink('phone', '+233200000000')).toBe('tel:+233200000000');
    expect(supportLink('whatsapp', '+233200000000', '12345678-ride')).toContain('wa.me/233200000000');
    expect(supportLink('email', 'help@example.com', '12345678-ride')).toContain('mailto:help@example.com');
  });
  it('returns unavailable for missing channels', () => {
    expect(supportLink('phone', ' ')).toBeNull();
    expect(supportAvailability({ phone: '', whatsapp: '+2332', email: undefined })).toEqual({ phone: false, whatsapp: true, email: false });
  });
});
