/**
 * Ghana phone number utilities
 * Supports: MTN (024, 054, 055, 059), Telecel (020, 050), AT (027, 057, 026, 056)
 */

const GHANA_COUNTRY_CODE = '+233';
const GHANA_PHONE_REGEX = /^\+233[2-5][0-9]{8}$/;

export function normalizeGhanaPhone(phone: string): string {
  // Remove all whitespace, dashes, dots
  let cleaned = phone.replace(/[\s\-.()]/g, '');

  // Handle various formats
  if (cleaned.startsWith('+233')) {
    // Already international format
  } else if (cleaned.startsWith('233')) {
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('0')) {
    cleaned = GHANA_COUNTRY_CODE + cleaned.substring(1);
  } else if (cleaned.length === 9 && /^[2-5]/.test(cleaned)) {
    // Just the subscriber number without leading 0
    cleaned = GHANA_COUNTRY_CODE + cleaned;
  } else {
    // Try prepending country code
    cleaned = GHANA_COUNTRY_CODE + cleaned;
  }

  return cleaned;
}

export function validateGhanaPhone(phone: string): boolean {
  const normalized = normalizeGhanaPhone(phone);
  return GHANA_PHONE_REGEX.test(normalized);
}

export function maskPhone(phone: string): string {
  const normalized = normalizeGhanaPhone(phone);
  if (normalized.length < 10) return phone;
  // Show: +233XX***XXXX
  return normalized.slice(0, 6) + '***' + normalized.slice(-4);
}

export function getPhoneNetwork(phone: string): string | null {
  const normalized = normalizeGhanaPhone(phone);
  const subscriber = normalized.slice(4); // Remove +233

  if (/^(24|54|55|59)/.test(subscriber)) return 'MTN';
  if (/^(20|50)/.test(subscriber)) return 'Telecel';
  if (/^(27|57|26|56)/.test(subscriber)) return 'AT';
  return null;
}
