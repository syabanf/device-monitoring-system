import * as React from 'react';
import { appReducer, emptyState, type AppAction, type AppState } from '@monitoring/fixtures';
import { ApiError, endpoints, loadSnapshot, type Endpoints } from '@monitoring/api-client';
import { apiClient, readSession } from './client';
import { setLookups } from './lookups';
import { setLatestReadings } from './readings';
import { perform } from './commands';

type Status = 'loading' | 'ready' | 'error';

interface StateCtx {
  state: AppState;
  dispatch: (action: AppAction) => Promise<AppAction[]>;
  api: Endpoints;
  status: Status;
  error: string | null;
  clearError: () => void;
  reload: () => Promise<void>;
}
const Ctx = React.createContext<StateCtx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  // The session sits in localStorage, so the provider reads it without waiting for the auth
  // context above it.
  const [distributorId, setDistributorId] = React.useState(() => readSession()?.distributorId ?? '');
  const api = React.useMemo(() => endpoints(apiClient, distributorId), [distributorId]);
  const [state, apply] = React.useReducer(appReducer, undefined, emptyState);
  const [status, setStatus] = React.useState<Status>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  setLookups(state);

  const reload = React.useCallback(async () => {
    const tenant = readSession()?.distributorId ?? '';
    setDistributorId(tenant);
    if (!tenant) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const snapshot = await loadSnapshot(endpoints(apiClient, tenant));
      setLatestReadings(snapshot.latestReadings);
      apply({ type: 'state/hydrate', state: snapshot });
      setStatus('ready');
    } catch (err) {
      setError(describe(err));
      setStatus('error');
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const dispatch = React.useCallback<StateCtx['dispatch']>(
    async (action) => {
      try {
        const applied = await perform(api, stateRef.current, action);
        for (const next of applied) apply(next);
        return applied;
      } catch (err) {
        setError(describe(err));
        return [];
      }
    },
    [api],
  );

  const value = React.useMemo<StateCtx>(
    () => ({ state, dispatch, api, status, error, clearError: () => setError(null), reload }),
    [state, dispatch, api, status, error, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function describe(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  if (err instanceof Error) return `${err.message}. Is the API running?`;
  return 'The request failed.';
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

/**
 * What the signed-in account may see. The API already narrowed every list to the session's
 * outlets, so the ids are only used to keep a technician's wider view consistent.
 */
export function useMobileScope(outletIds: string[]) {
  const { state, dispatch } = useAppState();
  const inScope = React.useCallback(
    (outletId: string) => outletIds.length === 0 || outletIds.includes(outletId),
    [outletIds],
  );
  const outlets = React.useMemo(() => state.outlets.filter((o) => inScope(o.id)), [state.outlets, inScope]);
  const alerts = React.useMemo(() => state.alerts.filter((a) => inScope(a.outletId)), [state.alerts, inScope]);
  const devices = React.useMemo(() => state.devices.filter((d) => inScope(d.outletId)), [state.devices, inScope]);
  const sensors = React.useMemo(() => state.sensors.filter((s) => inScope(s.outletId)), [state.sensors, inScope]);
  const tickets = React.useMemo(() => state.tickets.filter((t) => inScope(t.outletId)), [state.tickets, inScope]);
  const devicesByOutlet = React.useMemo(() => group(devices, (d) => d.outletId), [devices]);
  const sensorsByDevice = React.useMemo(() => group(sensors, (s) => s.deviceId), [sensors]);
  return { outlets, alerts, devices, sensors, tickets, devicesByOutlet, sensorsByDevice, employees: state.employees, dispatch };
}

/** Alerts and outlets visible to a given employee. */
export function useEmployeeScope(outletIds: string[]) {
  const { outlets, alerts, employees, dispatch } = useMobileScope(outletIds);
  return { outlets, alerts, employees, dispatch };
}

function group<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) { const k = key(it); const arr = m.get(k); if (arr) arr.push(it); else m.set(k, [it]); }
  return m;
}
