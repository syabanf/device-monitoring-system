import * as React from 'react';
import { appReducer, buildInitialState, outletById, type AppAction, type AppState } from '@monitoring/fixtures';

interface StateCtx { state: AppState; dispatch: React.Dispatch<AppAction> }
const Ctx = React.createContext<StateCtx | null>(null);
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(appReducer, undefined, buildInitialState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}
export function useAppState() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAppState outside AppStateProvider');
  return ctx;
}

const READ_KEY = 'ms.mobile.read';
function readSet(): Set<number> {
  try { const raw = localStorage.getItem(READ_KEY); return new Set(raw ? (JSON.parse(raw) as number[]) : []); } catch { return new Set(); }
}
export function useReadAlerts() {
  const [read, setRead] = React.useState<Set<number>>(readSet);
  const markRead = React.useCallback((id: number) => {
    setRead((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      try { localStorage.setItem(READ_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return { read, markRead };
}

/** Alerts and outlets visible to a given employee. */
export function useEmployeeScope(outletIds: string[]) {
  const { state, dispatch } = useAppState();
  const outlets = React.useMemo(() => outletIds.map((id) => outletById.get(id)).filter((o): o is NonNullable<typeof o> => !!o), [outletIds]);
  const alerts = React.useMemo(() => state.alerts.filter((a) => outletIds.includes(a.outletId)), [state.alerts, outletIds]);
  return { outlets, alerts, employees: state.employees, dispatch };
}

/** Devices, sensors and tickets visible for a set of outlets (session state). */
export function useMobileScope(outletIds: string[]) {
  const { state, dispatch } = useAppState();
  const set = React.useMemo(() => new Set(outletIds), [outletIds]);
  const outlets = React.useMemo(() => outletIds.map((id) => outletById.get(id)).filter((o): o is NonNullable<typeof o> => !!o), [outletIds]);
  const alerts = React.useMemo(() => state.alerts.filter((a) => set.has(a.outletId)), [state.alerts, set]);
  const devices = React.useMemo(() => state.devices.filter((d) => set.has(d.outletId)), [state.devices, set]);
  const sensors = React.useMemo(() => state.sensors.filter((s) => set.has(s.outletId)), [state.sensors, set]);
  const tickets = React.useMemo(() => state.tickets.filter((t) => set.has(t.outletId)), [state.tickets, set]);
  const devicesByOutlet = React.useMemo(() => { const m = new Map<string, typeof devices>(); for (const d of devices) m.set(d.outletId, [...(m.get(d.outletId) ?? []), d]); return m; }, [devices]);
  const sensorsByDevice = React.useMemo(() => { const m = new Map<string, typeof sensors>(); for (const s of sensors) m.set(s.deviceId, [...(m.get(s.deviceId) ?? []), s]); return m; }, [sensors]);
  return { outlets, alerts, devices, sensors, tickets, devicesByOutlet, sensorsByDevice, employees: state.employees, dispatch };
}
