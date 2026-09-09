import type { Alert, AlertResponse, ContactPerson, Device, DeviceType, Distributor, Employee, MaintenanceTicket, Outlet, Sensor, Technician, TicketStatus } from '@monitoring/types';
import { alerts as fixtureAlerts, contactPersons as fixtureContacts, deviceTypes as fixtureDeviceTypes, devices as fixtureDevices, distributors as fixtureDistributors, employees as fixtureEmployees, maintenanceTickets as fixtureTickets, outlets as fixtureOutlets, sensors as fixtureSensors, technicians as fixtureTechnicians } from './accessors';
import { FIXTURE_NOW, FIXTURE_NOW_MS } from './constants';

/** Session-only mutable state seeded from the static fixtures. */
export interface AppState {
  alerts: Alert[];
  employees: Employee[];
  contacts: ContactPerson[];
  tickets: MaintenanceTicket[];
  devices: Device[];
  sensors: Sensor[];
  outlets: Outlet[];
  deviceTypes: DeviceType[];
  technicians: Technician[];
  distributors: Distributor[];
}

export type AppAction =
  | { type: 'alerts/acknowledge'; alertId: number; employeeId: string }
  | { type: 'alerts/startResponse'; alertId: number; employeeId: string }
  | { type: 'alerts/respond'; alertId: number; employeeId: string; notes: string; photoUrls: string[] }
  | { type: 'alerts/clear'; alertId: number }
  | { type: 'alerts/verify'; alertId: number }
  | { type: 'employees/approve'; employeeId: string }
  | { type: 'employees/generateToken'; employeeId: string; token: string }
  | { type: 'employees/revoke'; employeeId: string }
  | { type: 'contacts/upsert'; contact: ContactPerson }
  | { type: 'contacts/remove'; contactId: string }
  | { type: 'tickets/create'; ticket: MaintenanceTicket }
  | { type: 'tickets/setStatus'; ticketId: string; status: TicketStatus; notes?: string; photoUrls?: string[] }
  | { type: 'tickets/assign'; ticketId: string; technicianId: string | null }
  | { type: 'devices/add'; device: Device; sensors: Sensor[] }
  | { type: 'devices/remove'; deviceId: string }
  | { type: 'devices/upsert'; device: Device }
  | { type: 'sensors/upsert'; sensor: Sensor }
  | { type: 'sensors/remove'; sensorId: string }
  | { type: 'outlets/upsert'; outlet: Outlet }
  | { type: 'outlets/remove'; outletId: string }
  | { type: 'deviceTypes/upsert'; deviceType: DeviceType }
  | { type: 'deviceTypes/remove'; deviceTypeId: string }
  | { type: 'employees/upsert'; employee: Employee }
  | { type: 'employees/remove'; employeeId: string }
  | { type: 'technicians/upsert'; technician: Technician }
  | { type: 'technicians/remove'; technicianId: string }
  | { type: 'distributors/upsert'; distributor: Distributor }
  | { type: 'alerts/ingest'; alert: Alert };

export function buildInitialState(): AppState {
  const alerts = fixtureAlerts.map((alert) => ({
    ...alert,
    status: (alert.status as unknown as string) === 'TRIGGERED' ? 'UNACKNOWLEDGED' : (alert.status as unknown as string) === 'RESPONDED' ? 'RESOLVED' : (alert.status as unknown as string) === 'CLEARED' ? 'VERIFIED' : alert.status,
    assigneeEmployeeId: alert.response?.employeeId ?? null,
    acknowledgedAt: alert.response?.respondedAt ?? null,
    respondingAt: alert.response?.respondedAt ?? null,
    resolvedAt: alert.response?.respondedAt ?? alert.clearTime,
    verifiedAt: (alert.status as unknown as string) === 'CLEARED' ? alert.clearTime : null,
  })) as Alert[];
  return { alerts, employees: fixtureEmployees, contacts: fixtureContacts, tickets: fixtureTickets, devices: fixtureDevices, sensors: fixtureSensors, outlets: fixtureOutlets, deviceTypes: fixtureDeviceTypes, technicians: fixtureTechnicians, distributors: fixtureDistributors };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'alerts/acknowledge':
      return { ...state, alerts: state.alerts.map((a) => a.id === action.alertId && a.status === 'UNACKNOWLEDGED' ? { ...a, status: 'ACKNOWLEDGED', assigneeEmployeeId: action.employeeId, acknowledgedAt: FIXTURE_NOW } : a) };
    case 'alerts/startResponse':
      return { ...state, alerts: state.alerts.map((a) => a.id === action.alertId && (a.status === 'UNACKNOWLEDGED' || a.status === 'ACKNOWLEDGED') ? { ...a, status: 'RESPONDING', assigneeEmployeeId: action.employeeId, acknowledgedAt: a.acknowledgedAt ?? FIXTURE_NOW, respondingAt: FIXTURE_NOW } : a) };
    case 'alerts/respond': {
      return {
        ...state,
        alerts: state.alerts.map((a) => {
          if (a.id !== action.alertId || a.response || a.status !== 'RESPONDING' || a.assigneeEmployeeId !== action.employeeId) return a; // no stale or duplicate response
          const response: AlertResponse = {
            employeeId: action.employeeId,
            notes: action.notes,
            photoUrls: action.photoUrls,
            respondedAt: FIXTURE_NOW,
            responseDurationSec: Math.max(0, Math.round((FIXTURE_NOW_MS - Date.parse(a.triggerTime)) / 1000)),
          };
          return { ...a, response, status: 'RESOLVED', assigneeEmployeeId: action.employeeId, acknowledgedAt: a.acknowledgedAt ?? FIXTURE_NOW, respondingAt: a.respondingAt ?? FIXTURE_NOW, resolvedAt: FIXTURE_NOW };
        }),
      };
    }
    case 'alerts/clear':
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.alertId && a.status !== 'VERIFIED'
            ? { ...a, status: 'RESOLVED', resolvedAt: FIXTURE_NOW, clearTime: FIXTURE_NOW, clearValue: a.clearValue ?? 'Condition cleared by admin' }
            : a,
        ),
      };
    case 'alerts/verify':
      return { ...state, alerts: state.alerts.map((a) => a.id === action.alertId && a.status === 'RESOLVED' ? { ...a, status: 'VERIFIED', verifiedAt: FIXTURE_NOW } : a) };
    case 'employees/approve':
      return {
        ...state,
        employees: state.employees.map((e) =>
          e.id === action.employeeId ? { ...e, registrationStatus: 'approved', approvedAt: FIXTURE_NOW } : e,
        ),
      };
    case 'employees/generateToken':
      return {
        ...state,
        employees: state.employees.map((e) =>
          e.id === action.employeeId ? { ...e, registrationToken: action.token, registrationStatus: 'pending', approvedAt: null, registeredAt: FIXTURE_NOW } : e,
        ),
      };
    case 'employees/revoke':
      return {
        ...state,
        employees: state.employees.map((e) =>
          e.id === action.employeeId ? { ...e, registrationToken: null, registrationStatus: 'pending', approvedAt: null } : e,
        ),
      };
    case 'contacts/upsert': {
      const exists = state.contacts.some((c) => c.id === action.contact.id);
      return {
        ...state,
        contacts: exists ? state.contacts.map((c) => (c.id === action.contact.id ? action.contact : c)) : [action.contact, ...state.contacts],
      };
    }
    case 'contacts/remove':
      return { ...state, contacts: state.contacts.filter((c) => c.id !== action.contactId) };
    case 'tickets/create':
      return { ...state, tickets: [action.ticket, ...state.tickets] };
    case 'tickets/setStatus':
      return {
        ...state,
        tickets: state.tickets.map((t) =>
          t.id === action.ticketId
            ? { ...t, status: action.status, completedAt: action.status === 'DONE' ? FIXTURE_NOW : null, scheduledAt: action.status === 'SCHEDULED' && !t.scheduledAt ? FIXTURE_NOW : t.scheduledAt, notes: action.notes?.trim() ? action.notes.trim() : t.notes, photoUrls: action.photoUrls?.length ? [...t.photoUrls, ...action.photoUrls] : t.photoUrls }
            : t,
        ),
      };
    case 'tickets/assign':
      return { ...state, tickets: state.tickets.map((t) => (t.id === action.ticketId ? { ...t, technicianId: action.technicianId } : t)) };
    case 'devices/add':
      return { ...state, devices: [action.device, ...state.devices], sensors: [...state.sensors, ...action.sensors] };
    case 'devices/remove':
      return { ...state, devices: state.devices.filter((d) => d.id !== action.deviceId), sensors: state.sensors.filter((s) => s.deviceId !== action.deviceId), tickets: state.tickets.filter((t) => t.deviceId !== action.deviceId) };
    case 'devices/upsert':
      return { ...state, devices: upsert(state.devices, action.device) };
    case 'sensors/upsert': {
      const sensors = upsert(state.sensors, action.sensor);
      // keep the device port map in sync
      const devices = state.devices.map((d) => {
        if (d.id !== action.sensor.deviceId) return d;
        return { ...d, ports: d.ports.map((p) => (p.sensorId === action.sensor.id ? { ...p, sensorId: null } : p)).map((p) => (p.kind === action.sensor.portKind && p.index === action.sensor.portIndex ? { ...p, sensorId: action.sensor.id } : p)) };
      });
      return { ...state, sensors, devices };
    }
    case 'sensors/remove':
      return { ...state, sensors: state.sensors.filter((s) => s.id !== action.sensorId), devices: state.devices.map((d) => ({ ...d, ports: d.ports.map((p) => (p.sensorId === action.sensorId ? { ...p, sensorId: null } : p)) })) };
    case 'outlets/upsert':
      return { ...state, outlets: upsert(state.outlets, action.outlet) };
    case 'outlets/remove': {
      const deviceIds = new Set(state.devices.filter((d) => d.outletId === action.outletId).map((d) => d.id));
      return {
        ...state,
        outlets: state.outlets.filter((o) => o.id !== action.outletId),
        devices: state.devices.filter((d) => !deviceIds.has(d.id)),
        sensors: state.sensors.filter((s) => !deviceIds.has(s.deviceId)),
        contacts: state.contacts.filter((c) => c.outletId !== action.outletId),
        tickets: state.tickets.filter((t) => t.outletId !== action.outletId),
        alerts: state.alerts.filter((a) => a.outletId !== action.outletId),
        employees: state.employees.map((e) => ({ ...e, outletIds: e.outletIds.filter((id) => id !== action.outletId) })).filter((e) => e.outletIds.length > 0),
      };
    }
    case 'deviceTypes/upsert':
      return { ...state, deviceTypes: upsert(state.deviceTypes, action.deviceType) };
    case 'deviceTypes/remove':
      return { ...state, deviceTypes: state.deviceTypes.filter((t) => t.id !== action.deviceTypeId) };
    case 'employees/upsert':
      return { ...state, employees: upsert(state.employees, action.employee) };
    case 'employees/remove':
      return { ...state, employees: state.employees.filter((e) => e.id !== action.employeeId) };
    case 'technicians/upsert':
      return { ...state, technicians: upsert(state.technicians, action.technician) };
    case 'technicians/remove':
      return { ...state, technicians: state.technicians.filter((t) => t.id !== action.technicianId), tickets: state.tickets.map((t) => (t.technicianId === action.technicianId ? { ...t, technicianId: null } : t)) };
    case 'distributors/upsert':
      return { ...state, distributors: upsert(state.distributors, action.distributor) };
    case 'alerts/ingest': {
      // A resolved sensor event closes the condition; an administrator can verify it separately.
      if (action.alert.status === 'RESOLVED') {
        const open = state.alerts.find((a) => a.sensorId === action.alert.sensorId && a.status !== 'VERIFIED');
        if (open) return { ...state, alerts: state.alerts.map((a) => (a.id === open.id ? { ...a, status: 'RESOLVED', resolvedAt: action.alert.triggerTime, clearTime: action.alert.triggerTime, clearValue: action.alert.triggerValue } : a)) };
      }
      return { ...state, alerts: [action.alert, ...state.alerts] };
    }
    default:
      return state;
  }
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function generateToken(): string {
  return String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999));
}
