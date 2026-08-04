const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const ACCESS_TOKEN_KEY = 'admin_token';
const REFRESH_TOKEN_KEY = 'admin_refresh_token';

export function storeAdminSession(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearAdminSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasAdminSession(): boolean {
  return typeof window !== 'undefined' && Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
}

// Decode the role from the stored access token's JWT payload so client-side
// UI (e.g. dashboard nav gating) can hide routes the signed-in role cannot
// use, instead of rendering them and letting the user hit a 403. The backend
// remains the authoritative authorizer; this is purely to avoid the
// misleading 'Failed to load …' banners on pages a role should never reach.
// Returns null on any decode failure — callers fall back to showing all nav
// items (preserving prior behaviour) rather than locking a valid session out.
export function getAdminRole(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  skipAuth = false,
  allowRefresh = true,
): Promise<T> {
  const token =
    !skipAuth && typeof window !== 'undefined'
      ? localStorage.getItem(ACCESS_TOKEN_KEY)
      : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !skipAuth && allowRefresh && typeof window !== 'undefined') {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      const refreshResponse = await fetch(`${BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshResponse.ok) {
        const refreshed = (await refreshResponse.json()) as {
          accessToken: string;
          refreshToken: string;
        };
        storeAdminSession(refreshed.accessToken, refreshed.refreshToken);
        return request<T>(path, options, false, false);
      }
    }
  }

if (res.status === 401 && !skipAuth) {
    // A 401 on an authenticated request means the session is no longer
    // usable (the refresh above either did not run or failed). Clear it and
    // send the user to the login page. This branch is intentionally skipped
    // for `skipAuth` callers (the login flow's request-otp / verify-otp
    // requests): a wrong code or expired OTP legitimately returns 401, and
    // redirecting/clearing there would fling the user off the login form and
    // swallow the inline error message they should see.
    if (typeof window !== 'undefined') {
      clearAdminSession();
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (res.status === 401 && skipAuth) {
    // Public auth endpoints (e.g. verify-otp) returned 401 — surface the
    // body message so the login form can display it inline instead of the
    // generic 'Unauthorized' string.
    const body = await res.json().catch(() => ({ message: 'Unauthorized' }));
    throw new ApiError(401, body.message || 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message || res.statusText);
  }

  return res.json();
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },

  postPublic<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(
      path,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      },
      true,
      false,
    );
  },
};
