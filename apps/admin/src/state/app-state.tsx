import * as React from 'react';
import { appReducer, emptyState, type AppAction, type AppState } from '@monitoring/fixtures';
import { ApiError, loadSnapshot, type Endpoints } from '@monitoring/api-client';
import type { Device, Sensor } from '@monitoring/types';
import { setLookups } from './lookups';
import { setLatestReadings } from './readings';
import { perform } from './commands';
import { apiFor } from './client';
import { useAuth } from '../auth/auth';

type Status = 'loading' | 'ready' | 'error';

interface StateCtx {
  state: AppState;
  /** Sends the action to the API, then applies what the server wrote. */
  dispatch: (action: AppAction) => Promise<AppAction[]>;
  api: Endpoints;
  status: Status;
  /** The last failed write, which the layout shows and the user dismisses. */
  error: string | null;
  clearError: () => void;
  reload: () => Promise<void>;
}
const Ctx = React.createContext<StateCtx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const distributorId = session?.distributorId ?? '';
  const api = React.useMemo(() => apiFor(distributorId), [distributorId]);

  const [state, apply] = React.useReducer(appReducer, undefined, emptyState);
  const [status, setStatus] = React.useState<Status>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  setLookups(state);

  const reload = React.useCallback(async () => {
    if (!distributorId) return;
    setStatus('loading');
    try {
      const snapshot = await loadSnapshot(api);
      setLatestReadings(snapshot.latestReadings);
      apply({ type: 'state/hydrate', state: snapshot });
      setStatus('ready');
    } catch (err) {
      setError(describe(err));
      setStatus('error');
    }
  }, [api, distributorId]);

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

/** Everything the current admin can see, scoped to their distributor. */
export function useScoped() {
  const { state, dispatch } = useAppState();
  const { session } = useAuth();
  const distributorId = session?.distributorId ?? '';
  const outlets = React.useMemo(() => state.outlets.filter((o) => o.distributorId === distributorId), [state.outlets, distributorId]);
  const outletIds = React.useMemo(() => new Set(outlets.map((o) => o.id)), [outlets]);
  const alerts = React.useMemo(() => state.alerts.filter((a) => a.distributorId === distributorId), [state.alerts, distributorId]);
  const employees = React.useMemo(() => state.employees.filter((e) => e.distributorId === distributorId), [state.employees, distributorId]);
  const contacts = React.useMemo(() => state.contacts.filter((c) => outletIds.has(c.outletId)), [state.contacts, outletIds]);
  const tickets = React.useMemo(() => state.tickets.filter((t) => t.distributorId === distributorId), [state.tickets, distributorId]);
  const technicians = React.useMemo(() => state.technicians.filter((t) => t.distributorId === distributorId), [state.technicians, distributorId]);
  const deviceTypes = state.deviceTypes;
  const outletById = React.useMemo(() => new Map(outlets.map((o) => [o.id, o])), [outlets]);
  const technicianById = React.useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);
  const deviceTypeById = React.useMemo(() => new Map(deviceTypes.map((t) => [t.id, t])), [deviceTypes]);
  const devices = React.useMemo(() => state.devices.filter((d) => outletIds.has(d.outletId)), [state.devices, outletIds]);
  const sensors = React.useMemo(() => state.sensors.filter((s) => outletIds.has(s.outletId)), [state.sensors, outletIds]);
  const devicesByOutlet = React.useMemo(() => group(devices, (d) => d.outletId), [devices]);
  const sensorsByDevice = React.useMemo(() => group(sensors, (s) => s.deviceId), [sensors]);
  const sensorsByOutlet = React.useMemo(() => group(sensors, (s) => s.outletId), [sensors]);
  const deviceById = React.useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const sensorById = React.useMemo(() => new Map(sensors.map((s) => [s.id, s])), [sensors]);
  return { distributorId, outlets, outletIds, alerts, employees, contacts, tickets, technicians, deviceTypes, devices, sensors, devicesByOutlet, sensorsByDevice, sensorsByOutlet, deviceById, sensorById, outletById, technicianById, deviceTypeById, dispatch };
}

function group<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) { const k = key(it); const arr = m.get(k); if (arr) arr.push(it); else m.set(k, [it]); }
  return m;
}
export type { Device, Sensor };
