import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  userId: string | null;
  setAuthenticated: (value: boolean) => void;
  setTokens: (accessToken: string, userId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  accessToken: null,
  userId: null,
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setTokens: (accessToken, userId) => set({ accessToken, userId, isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false, accessToken: null, userId: null }),
}));
