import type { AppState } from '@monitoring/fixtures';
import type { Alert, Outlet, Technician } from '@monitoring/types';

// Live lookups over the loaded state, so a card can resolve an outlet or technician name
// without threading the whole tenant through its props.
let snapshot: AppState | null = null;
let outletMap = new Map<string, Outlet>();
let techMap = new Map<string, Technician>();
let alertMap = new Map<number, Alert>();

export function setLookups(state: AppState) {
  if (state === snapshot) return;
  snapshot = state;
  outletMap = new Map(state.outlets.map((o) => [o.id, o]));
  techMap = new Map(state.technicians.map((t) => [t.id, t]));
  alertMap = new Map(state.alerts.map((a) => [a.id, a]));
}
export const outletById = { get: (id: string) => outletMap.get(id) };
export const technicianById = { get: (id: string) => techMap.get(id) };
export const alertById = { get: (id: number) => alertMap.get(id) };
