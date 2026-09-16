import { ApiClient, endpoints, type Endpoints } from '@monitoring/api-client';
import type { Session } from '@monitoring/types';

/** The API the app talks to. Vite reads VITE_API_URL from apps/mobile/.env. */
export const API_URL: string = window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STORAGE_KEY = 'ms.mobile.session';

/** The signed-in employee or technician, kept in localStorage so a reload stays signed in. */
export interface StoredSession extends Session {
  accessToken: string;
  name: string;
  email: string;
  role: string;
  outletIds: string[];
}

export function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
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
