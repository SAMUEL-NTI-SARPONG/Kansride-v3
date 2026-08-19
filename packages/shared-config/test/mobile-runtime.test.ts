import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import {
  developmentReviewModeEnabled,
  mobileRuntimeUrl,
  validatePhysicalDeviceUrl,
} from '../src/mobile-runtime';

describe('physical-device mobile URL validation', () => {
  it('is exposed through the mobile-safe package entry point', () => {
    expect(packageJson.exports['./mobile-runtime']).toEqual({
      types: './src/mobile-runtime.ts',
      default: './src/mobile-runtime.ts',
    });
    expect(mobileRuntimeUrl('EXPO_PUBLIC_API_URL', 'http://192.168.1.20:3000', 'http://localhost:3000'))
      .toBe('http://192.168.1.20:3000');
  });

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

  it('allows UI review mode only in development with an explicit flag', () => {
    expect(developmentReviewModeEnabled('development', 'true')).toBe(true);
    expect(developmentReviewModeEnabled('production', 'true')).toBe(false);
    expect(developmentReviewModeEnabled('test', 'true')).toBe(false);
    expect(developmentReviewModeEnabled('development', undefined)).toBe(false);
    expect(developmentReviewModeEnabled('development', 'false')).toBe(false);
  });
});
