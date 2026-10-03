import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const isValidPIN = (pin: string): boolean => /^\d{4}$/.test(pin);

export function hashPIN(pin: string): string {
  if (!isValidPIN(pin)) throw new Error('PIN must contain exactly 4 digits');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`;
}

export function verifyPIN(pin: string, stored: string): boolean {
  if (!isValidPIN(pin)) return false;
  const [salt, digest] = stored.split(':');
  if (!salt || !digest) return false;
  const actual = scryptSync(pin, salt, 32);
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
