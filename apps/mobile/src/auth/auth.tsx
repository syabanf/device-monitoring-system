import * as React from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Employee, Session, Technician } from '@monitoring/types';
import { FIXTURE_NOW, findEmployeeByEmail, findTechnicianByEmail, outletsByDistributor, technicianById } from '@monitoring/fixtures';
import { useAppState } from '../state/app-state';

const STORAGE_KEY = 'ms.mobile.session';

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
  login: (email: string, token: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
}
const Ctx = React.createContext<AuthCtx | null>(null);
function readSession(): Session | null {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? (JSON.parse(raw) as Session) : null; } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(readSession);
  const { state } = useAppState();

  const user = React.useMemo<MobileUser | null>(() => {
    if (!session) return null;
    if (session.kind === 'technician') {
      const t = technicianById.get(session.userId);
      if (!t) return null;
      return { id: t.id, kind: 'technician', name: t.name, email: t.email, phone: t.phone, avatarColor: t.avatarColor, distributorId: t.distributorId, outletIds: (outletsByDistributor.get(t.distributorId) ?? []).map((o) => o.id), technician: t };
    }
    const e = state.employees.find((x) => x.id === session.userId);
    if (!e) return null;
    return { id: e.id, kind: 'employee', name: e.name, email: e.email, phone: e.phone, avatarColor: e.avatarColor, distributorId: e.distributorId, outletIds: e.outletIds, employee: e };
  }, [session, state.employees]);

  const login = React.useCallback<AuthCtx['login']>((email, token) => {
    const emp = findEmployeeByEmail(email);
    const tech = emp ? undefined : findTechnicianByEmail(email);
    if (!emp && !tech) return { ok: false, error: 'Email not registered. Contact your admin.' };
    const expected = emp ? emp.registrationToken : tech!.registrationToken;
    if (!expected || expected !== token.trim()) return { ok: false, error: 'Invalid token for this account.' };
    const s: Session = emp
      ? { kind: 'employee', userId: emp.id, distributorId: emp.distributorId, loggedInAt: FIXTURE_NOW }
      : { kind: 'technician', userId: tech!.id, distributorId: tech!.distributorId, loggedInAt: FIXTURE_NOW };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
    setSession(s);
    return { ok: true };
  }, []);
  const logout = React.useCallback(() => { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } setSession(null); }, []);
  return <Ctx.Provider value={{ session, user, employee: user?.employee ?? null, login, logout }}>{children}</Ctx.Provider>;
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
