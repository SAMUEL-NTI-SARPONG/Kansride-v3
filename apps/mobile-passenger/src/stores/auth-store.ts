import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storeTokens, clearTokens, getAccessToken } from '../api/client';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';

export interface User {
  id: string;
  phone: string;
  name?: string;
  totalRides?: number;
}

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;

  // Actions
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoading: true,

  setTokens: async (accessToken, refreshToken) => {
    await storeTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await clearTokens();
    set({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
    });
  },

  hydrate: async () => {
    if (
      developmentReviewModeEnabled(
        process.env.NODE_ENV,
        process.env.EXPO_PUBLIC_UI_REVIEW_MODE,
      )
    ) {
      set({
        isAuthenticated: true,
        user: {
          id: 'ui-review-passenger',
          phone: '+233 20 000 0000',
          name: 'UI Review Passenger',
          totalRides: 12,
        },
        isLoading: false,
      });
      return;
    }
    try {
      const token = await getAccessToken();
      if (token) {
        set({ accessToken: token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
