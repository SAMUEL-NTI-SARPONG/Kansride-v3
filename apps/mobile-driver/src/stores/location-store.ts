import { create } from 'zustand';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  lastUpdated: number | null;
  setLocation: (lat: number, lng: number) => void;
  getLocation: () => { latitude: number; longitude: number } | null;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  latitude: null,
  longitude: null,
  lastUpdated: null,

  setLocation: (latitude, longitude) =>
    set({ latitude, longitude, lastUpdated: Date.now() }),

  getLocation: () => {
    const state = get();
    if (state.latitude === null || state.longitude === null || state.lastUpdated === null) {
      return null;
    }
    return { latitude: state.latitude, longitude: state.longitude };
  },
}));
