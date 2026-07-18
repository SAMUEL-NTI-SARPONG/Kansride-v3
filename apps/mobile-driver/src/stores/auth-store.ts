import { create } from 'zustand';
import { storeTokens, clearTokens, getStoredToken } from '../api/client';

interface UserData {
  id: string;
  phoneNumber: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserData | null;
  isLoading: boolean;

  setTokens: (accessToken: string, refreshToken: string, user: UserData) => void;
  logout: () => void;
  initialize: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoading: true,

  setTokens: async (accessToken, refreshToken, user) => {
    await storeTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken, user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    await clearTokens();
    set({ isAuthenticated: false, accessToken: null, refreshToken: null, user: null });
  },

  initialize: async () => {
    const token = await getStoredToken();
    if (token) {
      set({ isAuthenticated: true, accessToken: token, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
}));
