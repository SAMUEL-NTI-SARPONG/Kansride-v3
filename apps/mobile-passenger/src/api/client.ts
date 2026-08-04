import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/auth-store';
import { mobileRuntimeUrl } from '@kansride/config';

const API_BASE_URL = mobileRuntimeUrl(
  'EXPO_PUBLIC_API_URL',
  process.env.EXPO_PUBLIC_API_URL,
  'http://localhost:3000/api/v1',
);

const TOKEN_KEY = 'kansride_access_token';
const REFRESH_TOKEN_KEY = 'kansride_refresh_token';

// Token storage helpers
export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function storeTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

// Refresh token logic
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      await clearTokens();
      return null;
    }

    const data = await response.json();
    await storeTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    await clearTokens();
    return null;
  }
}

// Core fetch wrapper
async function request<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    skipAuth?: boolean;
  } = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401. refreshAccessToken already clears stored tokens on
  // failure; here we also reset the auth store so the (main) route guard
  // redirects to the auth flow instead of leaving the passenger stuck on the
  // main tabs with a raw 'SESSION_EXPIRED' Alert on every call.
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

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// Public API methods
export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body });
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body });
}

// Unauthenticated request (for login/otp)
export function postPublic<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body, skipAuth: true });
}

export const apiClient = { get, post, put, patch, postPublic };
export default apiClient;
