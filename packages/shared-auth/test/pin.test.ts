import { describe, expect, it } from 'vitest';
import { hashPIN, isValidPIN, verifyPIN } from '../src/pin';

describe('account PIN security', () => {
  it('accepts exactly four digits', () => {
    expect(isValidPIN('0427')).toBe(true);
    expect(isValidPIN('123')).toBe(false);
    expect(isValidPIN('12a4')).toBe(false);
  });

  it('stores a salted hash and verifies without retaining the PIN', () => {
    const first = hashPIN('0427');
    const second = hashPIN('0427');
    expect(first).not.toContain('0427');
    expect(first).not.toBe(second);
    expect(verifyPIN('0427', first)).toBe(true);
    expect(verifyPIN('0428', first)).toBe(false);
  });
});
