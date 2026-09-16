import type { AppState } from '@monitoring/fixtures';
import type { Alert, Device, DeviceType, Distributor, Employee, Outlet, Sensor, Technician } from '@monitoring/types';

// Live lookups backed by the loaded tenant. Components re-render through their own state hooks;
// these maps just read the latest snapshot so names stay correct after an edit or a reload.
let snapshot: AppState | null = null;
let outletMap = new Map<string, Outlet>();
let techMap = new Map<string, Technician>();
let typeMap = new Map<string, DeviceType>();
let deviceMap = new Map<string, Device>();
let sensorMap = new Map<string, Sensor>();
let employeeMap = new Map<string, Employee>();
let alertMap = new Map<number, Alert>();
let distributorMap = new Map<string, Distributor>();

export function setLookups(state: AppState) {
  if (state === snapshot) return;
  snapshot = state;
  outletMap = new Map(state.outlets.map((o) => [o.id, o]));
  techMap = new Map(state.technicians.map((t) => [t.id, t]));
  typeMap = new Map(state.deviceTypes.map((t) => [t.id, t]));
  deviceMap = new Map(state.devices.map((d) => [d.id, d]));
  sensorMap = new Map(state.sensors.map((s) => [s.id, s]));
  employeeMap = new Map(state.employees.map((e) => [e.id, e]));
  alertMap = new Map(state.alerts.map((a) => [a.id, a]));
  distributorMap = new Map(state.distributors.map((d) => [d.id, d]));
}
export const outletById = { get: (id: string) => outletMap.get(id) };
export const technicianById = { get: (id: string) => techMap.get(id) };
export const deviceTypeById = { get: (id: string) => typeMap.get(id) };
export const deviceById = { get: (id: string) => deviceMap.get(id) };
export const sensorById = { get: (id: string) => sensorMap.get(id) };
export const employeeById = { get: (id: string) => employeeMap.get(id) };
export const alertById = { get: (id: number) => alertMap.get(id) };
export const distributorById = { get: (id: string) => distributorMap.get(id) };
