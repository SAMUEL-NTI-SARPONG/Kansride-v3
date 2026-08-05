import { describe, expect, it } from 'vitest';
import { navigationRegion, navigationTargetForStatus, navigationUrl } from '../src/navigation';

describe('driver navigation helpers', () => {
  it('selects pickup before passenger collection and destination after', () => {
    expect(navigationTargetForStatus('driver_en_route')).toBe('pickup');
    expect(navigationTargetForStatus('passenger_verified')).toBe('destination');
  });
  it('constructs safe external navigation URLs', () => {
    expect(navigationUrl(5.6, -0.2)).toContain('destination=5.6,-0.2');
    expect(navigationUrl(91, 0)).toBeNull();
  });
  it('calculates a region around valid marker points', () => {
    expect(navigationRegion([{ latitude: 5, longitude: -1 }, { latitude: 6, longitude: -2 }])).toMatchObject({ latitude: 5.5, longitude: -1.5 });
    expect(navigationRegion([])).toBeNull();
  });
});
