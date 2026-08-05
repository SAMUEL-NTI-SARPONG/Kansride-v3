import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVED_PLACES_KEY = 'kansride_passenger_saved_places';
export type SavedPlaceKind = 'home' | 'work' | 'custom';

export interface SavedPlace {
  id: string;
  label: string;
  kind: SavedPlaceKind;
  latitude: number;
  longitude: number;
}

export function normalizeSavedPlace(input: Partial<SavedPlace>): SavedPlace | null {
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const kind = input.kind === 'home' || input.kind === 'work' || input.kind === 'custom' ? input.kind : 'custom';
  if (!label || label.length > 80 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { id: typeof input.id === 'string' && input.id ? input.id : `${kind}-${Date.now()}`, label, kind, latitude, longitude };
}

export function parseSavedPlaces(raw: string | null): SavedPlace[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.map((item) => normalizeSavedPlace(item)).filter((item): item is SavedPlace => item !== null);
    const byKind = new Map<SavedPlaceKind, SavedPlace>();
  for (const place of valid) {
    if (place.kind === 'home' || place.kind === 'work') byKind.set(place.kind, place);
  }
  const fixed = valid.filter((place) => place.kind === 'custom' || byKind.get(place.kind)?.id === place.id);
  return fixed;
  } catch {
    return [];
  }
}

export async function loadSavedPlaces(): Promise<SavedPlace[]> {
  return parseSavedPlaces(await AsyncStorage.getItem(SAVED_PLACES_KEY));
}

export async function saveSavedPlaces(places: SavedPlace[]): Promise<void> {
  await AsyncStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(places.map(normalizeSavedPlace).filter((place): place is SavedPlace => place !== null)));
}

export async function upsertSavedPlace(place: Partial<SavedPlace>): Promise<SavedPlace[]> {
  const normalized = normalizeSavedPlace(place);
  if (!normalized) throw new Error('Enter a label and valid coordinates.');
  const places = await loadSavedPlaces();
  const next = places.filter((item) => item.id !== normalized.id && (normalized.kind === 'custom' || item.kind !== normalized.kind));
  next.push(normalized);
  await saveSavedPlaces(next);
  return next;
}

export async function removeSavedPlace(id: string): Promise<SavedPlace[]> {
  const next = (await loadSavedPlaces()).filter((place) => place.id !== id);
  await saveSavedPlaces(next);
  return next;
}
