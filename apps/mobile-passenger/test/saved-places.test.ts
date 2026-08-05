import { describe, expect, it } from 'vitest';
import { normalizeSavedPlace, parseSavedPlaces, type SavedPlace } from '../src/saved-places';

describe('saved places persistence rules', () => {
  it('normalizes labels and rejects invalid coordinates', () => {
    expect(normalizeSavedPlace({ id: '1', kind: 'custom', label: '  Home  ', latitude: '5.6' as never, longitude: '-0.2' as never })?.label).toBe('Home');
    expect(normalizeSavedPlace({ kind: 'custom', label: 'Bad', latitude: 91, longitude: 0 })).toBeNull();
  });

  it('recovers corrupt data and keeps one Home and Work record', () => {
    const places = parseSavedPlaces(JSON.stringify([
      { id: 'home-1', kind: 'home', label: 'Old Home', latitude: 5, longitude: -1 },
      { id: 'home-2', kind: 'home', label: 'New Home', latitude: 6, longitude: -2 },
      { id: 'work-1', kind: 'work', label: 'Work', latitude: 5.1, longitude: -1.1 },
      { id: 'custom-1', kind: 'custom', label: 'Gym', latitude: 5.2, longitude: -1.2 },
      { corrupted: true },
    ]));
    expect(places).toHaveLength(3);
    expect(places.filter((place) => place.kind === 'home')).toHaveLength(1);
    expect(places.find((place) => place.kind === 'custom')?.label).toBe('Gym');
  });

  it('returns empty data for obsolete non-array storage', () => {
    expect(parseSavedPlaces('{"old":true}')).toEqual([]);
  });
});
