import * as React from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Employee, Session, Technician } from '@monitoring/types';
import { ApiError, auth as authApi } from '@monitoring/api-client';
import { BRAND } from '@monitoring/ui';
import { apiClient, clearSession, onSessionExpired, readSession, writeSession, type StoredSession } from '../state/client';
import { useAppState } from '../state/app-state';

export interface MobileUser {
  id: string;
  kind: 'employee' | 'technician';
  name: string;
  email: string;
  phone: string;
  avatarColor: string;
  distributorId: string;
  outletIds: string[];
  employee?: Employee;
  technician?: Technician;
}
interface AuthCtx {
  session: Session | null;
  user: MobileUser | null;
  /** @deprecated use user.employee */
  employee: Employee | null;
  login: (email: string, token: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
}
const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = React.useState<StoredSession | null>(readSession);
  const { state, reload } = useAppState();

  React.useEffect(() => {
    onSessionExpired(() => {
      clearSession();
      setStored(null);
    });
  }, []);

  // The account row carries the phone number and colour the profile screen shows; until the
  // tenant lands, the login response is enough to render the header.
  const user = React.useMemo<MobileUser | null>(() => {
    if (!stored) return null;
    const base: MobileUser = {
      id: stored.userId,
      kind: stored.kind === 'technician' ? 'technician' : 'employee',
      name: stored.name,
      email: stored.email,
      phone: '',
      avatarColor: BRAND.ink,
      distributorId: stored.distributorId,
      outletIds: stored.outletIds,
    };
    if (base.kind === 'technician') {
      const t = state.technicians.find((x) => x.id === stored.userId);
      return t ? { ...base, phone: t.phone, avatarColor: t.avatarColor, technician: t } : base;
    }
    const e = state.employees.find((x) => x.id === stored.userId);
    return e ? { ...base, phone: e.phone, avatarColor: e.avatarColor, outletIds: e.outletIds, employee: e } : base;
  }, [stored, state.employees, state.technicians]);

  const login = React.useCallback<AuthCtx['login']>(
    async (email, token) => {
      try {
        const result = await authApi.tokenLogin(apiClient, email.trim().toLowerCase(), token.trim());
        const session: StoredSession = {
          kind: result.session.kind,
          userId: result.session.sub,
          distributorId: result.session.distributorId,
          loggedInAt: new Date().toISOString(),
          accessToken: result.accessToken,
          name: result.session.name,
          email: result.session.email,
          role: result.session.role ?? '',
          outletIds: result.session.outletIds ?? [],
        };
        writeSession(session);
        setStored(session);
        await reload();
        return { ok: true };
      } catch (err) {
        if (err instanceof ApiError) return { ok: false, error: err.detail };
        return { ok: false, error: 'Cannot reach the API. Check that it is running.' };
      }
    },
    [reload],
  );

  const logout = React.useCallback(() => {
    clearSession();
    setStored(null);
  }, []);

  const value = React.useMemo<AuthCtx>(
    () => ({ session: stored, user, employee: user?.employee ?? null, login, logout }),
    [stored, user, login, logout],
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
