import { hc } from 'hono/client';
import type { AppType } from '../server/index';

export const AUTH_TOKEN_STORAGE_KEY = 'akuntan_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage error
  }
}

export function getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  return {
    ...(extraHeaders || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export const api = hc<AppType>('/', {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getAuthToken();
    const headers = new Headers(init?.headers);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(input, {
      ...init,
      headers,
      credentials: 'include'
    });
  }
});
