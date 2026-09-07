import type { AppState } from '@monitoring/fixtures';
import type { DeviceType, Outlet, Technician } from '@monitoring/types';

// Live lookups backed by the session store. Components re-render through their own state hooks;
// these maps just read the latest snapshot so names stay correct after master-data edits.
let snapshot: AppState | null = null;
let outletMap = new Map<string, Outlet>();
let techMap = new Map<string, Technician>();
let typeMap = new Map<string, DeviceType>();

export function setLookups(state: AppState) {
  if (state === snapshot) return;
  snapshot = state;
  outletMap = new Map(state.outlets.map((o) => [o.id, o]));
  techMap = new Map(state.technicians.map((t) => [t.id, t]));
  typeMap = new Map(state.deviceTypes.map((t) => [t.id, t]));
}
export const outletById = { get: (id: string) => outletMap.get(id) };
export const technicianById = { get: (id: string) => techMap.get(id) };
export const deviceTypeById = { get: (id: string) => typeMap.get(id) };
