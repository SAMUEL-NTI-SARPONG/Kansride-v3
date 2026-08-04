import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/auth-store';
import { mobileRuntimeUrl } from '@kansride/config';

const API_BASE_URL = mobileRuntimeUrl(
  'EXPO_PUBLIC_API_URL',
  process.env.EXPO_PUBLIC_API_URL,
  'http://localhost:3000/api/v1',
);

const TOKEN_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_KEY);
}

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(REFRESH_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    await storeTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth) {
    const token = await getStoredToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401. If the refresh fails (expired/revoked refresh
  // token), the session is over: clear storage, reset the auth store so the
  // (main) route guard redirects to the auth flow, and throw a typed
  // SESSION_EXPIRED error. Previously the client fell through and re-threw
  // the original 401 while leaving the auth store's isAuthenticated = true,
  // so the driver stayed stuck on the main tabs with a per-call Alert and no
  // redirect to login.
  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    } else {
      await clearTokens();
      await useAuthStore.getState().logout();
      const error = new Error('Session expired. Please sign in again.');
      error.name = 'SESSION_EXPIRED';
      throw error;
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  postNoAuth: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body, skipAuth: true }),
};
