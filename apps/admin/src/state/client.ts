import { ApiClient, endpoints, type Endpoints } from '@monitoring/api-client';
import type { Session } from '@monitoring/types';

/** The API the app talks to. Vite reads VITE_API_URL from apps/admin/.env. */
export const API_URL: string = window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STORAGE_KEY = 'ms.admin.session';

/** The signed-in admin, kept in localStorage so a reload stays signed in. */
export interface StoredSession extends Session {
  accessToken: string;
  name: string;
  email: string;
  role: string;
}

export function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isStoredSession(parsed)) return parsed;
    // The frontend-only build saved a session with no token under the same key. Drop it, so the
    // browser lands on the login form instead of crashing on the fields it lacks.
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

function isStoredSession(value: unknown): value is StoredSession {
  const s = value as Partial<StoredSession> | null;
  return !!s && typeof s.accessToken === 'string' && typeof s.distributorId === 'string'
    && typeof s.email === 'string' && typeof s.name === 'string';
}

export function writeSession(session: StoredSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* a private window still works for one session */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// The provider registers what to do when the API rejects the token, which is to sign out.
let expired: (() => void) | null = null;
export function onSessionExpired(handler: () => void) {
  expired = handler;
}

export const apiClient = new ApiClient({
  baseUrl: API_URL,
  token: () => readSession()?.accessToken ?? null,
  onUnauthorized: () => expired?.(),
});

export function apiFor(distributorId: string): Endpoints {
  return endpoints(apiClient, distributorId);
}
