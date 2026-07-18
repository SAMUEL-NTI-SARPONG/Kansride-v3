import { create } from 'zustand';

// Default to Kansawrodo, Sekondi-Takoradi area
const DEFAULT_LATITUDE = 4.92;
const DEFAULT_LONGITUDE = -1.76;

interface LocationState {
  latitude: number;
  longitude: number;
  lastUpdated: number | null;
  setLocation: (lat: number, lng: number) => void;
  getLocation: () => { latitude: number; longitude: number };
}

export const useLocationStore = create<LocationState>((set, get) => ({
  latitude: DEFAULT_LATITUDE,
  longitude: DEFAULT_LONGITUDE,
  lastUpdated: null,

  setLocation: (latitude, longitude) =>
    set({ latitude, longitude, lastUpdated: Date.now() }),

  getLocation: () => {
    const state = get();
    return { latitude: state.latitude, longitude: state.longitude };
  },
}));
