import * as React from 'react';
import { appReducer, buildInitialState, type AppAction, type AppState } from '@monitoring/fixtures';
import type { Device, Sensor } from '@monitoring/types';
import { setLookups } from './lookups';
import { useAuth } from '../auth/auth';

interface StateCtx {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}
const Ctx = React.createContext<StateCtx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(appReducer, undefined, buildInitialState);
  setLookups(state);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
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
