import * as React from 'react';
import { Navigate, useLocation } from 'react-router';
import type { AdminUser, Session } from '@monitoring/types';
import { DEMO_ACCOUNTS, FIXTURE_NOW, adminUserById, findAdminByEmail } from '@monitoring/fixtures';

const STORAGE_KEY = 'ms.admin.session';

interface AuthCtx {
  session: Session | null;
  user: AdminUser | null;
  login: (email: string, token: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
}
const Ctx = React.createContext<AuthCtx | null>(null);

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(readSession);
  const user = session ? (adminUserById.get(session.userId) ?? null) : null;

  const login = React.useCallback<AuthCtx['login']>((email, token) => {
    const admin = findAdminByEmail(email);
    if (!admin) return { ok: false, error: 'No admin account found for this email.' };
    if (token.trim() !== DEMO_ACCOUNTS.admin.token) return { ok: false, error: 'Invalid token.' };
    const s: Session = { kind: 'admin', userId: admin.id, distributorId: admin.distributorId, loggedInAt: FIXTURE_NOW };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
    setSession(s);
    return { ok: true };
  }, []);

  const logout = React.useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setSession(null);
  }, []);

  return <Ctx.Provider value={{ session, user, login, logout }}>{children}</Ctx.Provider>;
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
