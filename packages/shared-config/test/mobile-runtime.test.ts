import { describe, expect, it } from 'vitest';
import { validatePhysicalDeviceUrl } from '../src/mobile-runtime';

describe('physical-device mobile URL validation', () => {
  it('accepts a reachable LAN URL and removes one trailing slash', () => {
    expect(validatePhysicalDeviceUrl('EXPO_PUBLIC_API_URL', 'http://192.168.1.20:3000/api/v1/'))
      .toBe('http://192.168.1.20:3000/api/v1');
  });

  it('rejects missing and loopback URLs', () => {
    expect(() => validatePhysicalDeviceUrl('EXPO_PUBLIC_WS_URL', undefined)).toThrow(/required/);
    expect(() => validatePhysicalDeviceUrl('EXPO_PUBLIC_WS_URL', 'http://localhost:3000')).toThrow(/loopback/);
    expect(() => validatePhysicalDeviceUrl('EXPO_PUBLIC_WS_URL', 'http://127.0.0.1:3000')).toThrow(/loopback/);
  });

  it('rejects non-http schemes', () => {
    expect(() => validatePhysicalDeviceUrl('EXPO_PUBLIC_TRACKING_URL', 'file:///tracking')).toThrow(/http/);
  });
});
