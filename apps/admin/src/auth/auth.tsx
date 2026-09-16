import * as React from 'react';
import { Navigate, useLocation } from 'react-router';
import type { AdminUser, Session } from '@monitoring/types';
import { ApiError, auth as authApi } from '@monitoring/api-client';
import { apiClient, clearSession, onSessionExpired, readSession, writeSession, type StoredSession } from '../state/client';

interface AuthCtx {
  session: Session | null;
  user: AdminUser | null;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
}
const Ctx = React.createContext<AuthCtx | null>(null);

/** A stable colour per account, so the avatar looks the same on every machine. */
function avatarColor(seed: string): string {
  const palette = ['#1F2937', '#3F3F46', '#4C1D95', '#065F46', '#7C2D12', '#155E75'];
  let sum = 0;
  for (const ch of seed) sum += ch.charCodeAt(0);
  return palette[sum % palette.length];
}

function toUser(s: StoredSession): AdminUser {
  return { id: s.userId, distributorId: s.distributorId, name: s.name, email: s.email, role: 'admin', avatarColor: avatarColor(s.email) };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = React.useState<StoredSession | null>(readSession);

  React.useEffect(() => {
    onSessionExpired(() => {
      clearSession();
      setStored(null);
    });
  }, []);

  const login = React.useCallback<AuthCtx['login']>(async (email, password) => {
    try {
      const result = await authApi.adminLogin(apiClient, email.trim().toLowerCase(), password);
      const session: StoredSession = {
        kind: 'admin',
        userId: result.session.sub,
        distributorId: result.session.distributorId,
        loggedInAt: new Date().toISOString(),
        accessToken: result.accessToken,
        name: result.session.name,
        email: result.session.email,
        role: result.session.role ?? 'admin',
      };
      writeSession(session);
      setStored(session);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) return { ok: false, error: err.detail };
      return { ok: false, error: 'Cannot reach the API. Check that it is running.' };
    }
  }, []);

  const logout = React.useCallback(() => {
    clearSession();
    setStored(null);
  }, []);

  const value = React.useMemo<AuthCtx>(
    () => ({ session: stored, user: stored ? toUser(stored) : null, login, logout }),
    [stored, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
