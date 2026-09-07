import type {
  AdminUser,
  Alert,
  ContactPerson,
  Device,
  DeviceType,
  Distributor,
  Employee,
  MaintenanceTicket,
  Outlet,
  Reading,
  ReadingTuple,
  Sensor,
  Technician,
} from '@monitoring/types';
import {
  adminUsersRaw,
  alertsRaw,
  contactPersonsRaw,
  deviceTypesRaw,
  devicesRaw,
  distributorsRaw,
  employeesRaw,
  outletsRaw,
  readingsRaw,
  sensorsRaw,
  techniciansRaw,
  maintenanceTicketsRaw,
} from './data';

export const distributors = distributorsRaw as Distributor[];
export const outlets = outletsRaw as Outlet[];
export const deviceTypes = deviceTypesRaw as DeviceType[];
export const devices = devicesRaw as Device[];
export const sensors = sensorsRaw as Sensor[];
export const employees = employeesRaw as Employee[];
export const contactPersons = contactPersonsRaw as ContactPerson[];
export const adminUsers = adminUsersRaw as AdminUser[];
export const technicians = techniciansRaw as Technician[];
/** Sorted newest first. */
export const maintenanceTickets = [...(maintenanceTicketsRaw as MaintenanceTicket[])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
/** Sorted newest first. */
export const alerts = [...(alertsRaw as Alert[])].sort(
  (a, b) => Date.parse(b.triggerTime) - Date.parse(a.triggerTime),
);
export const readings: Reading[] = (readingsRaw as ReadingTuple[]).map(([sensorId, at, temperatureC, humidityPct]) => ({
  sensorId,
  at,
  temperatureC,
  humidityPct,
}));

function indexBy<T, K extends string | number>(items: T[], key: (t: T) => K): Map<K, T> {
  const m = new Map<K, T>();
  for (const it of items) m.set(key(it), it);
  return m;
}
function groupBy<T, K extends string | number>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export const distributorById = indexBy(distributors, (d) => d.id);
export const outletById = indexBy(outlets, (o) => o.id);
export const deviceTypeById = indexBy(deviceTypes, (d) => d.id);
export const deviceById = indexBy(devices, (d) => d.id);
export const sensorById = indexBy(sensors, (s) => s.id);
export const employeeById = indexBy(employees, (e) => e.id);
export const adminUserById = indexBy(adminUsers, (a) => a.id);
export const alertById = indexBy(alerts, (a) => a.id);
export const technicianById = indexBy(technicians, (t) => t.id);
export const ticketById = indexBy(maintenanceTickets, (t) => t.id);
export const ticketsByDevice = groupBy(maintenanceTickets, (t) => t.deviceId);
export const techniciansByDistributor = groupBy(technicians, (t) => t.distributorId);

export const outletsByDistributor = groupBy(outlets, (o) => o.distributorId);
export const devicesByOutlet = groupBy(devices, (d) => d.outletId);
export const sensorsByDevice = groupBy(sensors, (s) => s.deviceId);
export const sensorsByOutlet = groupBy(sensors, (s) => s.outletId);
export const alertsByOutlet = groupBy(alerts, (a) => a.outletId);
export const alertsByDistributor = groupBy(alerts, (a) => a.distributorId);
export const contactsByOutlet = groupBy(contactPersons, (c) => c.outletId);
export const readingsBySensor = groupBy(readings, (r) => r.sensorId);

export const employeesByOutlet: Map<string, Employee[]> = (() => {
  const m = new Map<string, Employee[]>();
  for (const e of employees)
    for (const oid of e.outletIds) {
      const arr = m.get(oid);
      if (arr) arr.push(e);
      else m.set(oid, [e]);
    }
  return m;
})();

export const latestReadingBySensor: Map<string, Reading> = (() => {
  const m = new Map<string, Reading>();
  for (const [sid, list] of readingsBySensor) {
    let latest = list[0]!;
    for (const r of list) if (r.at > latest.at) latest = r;
    m.set(sid, latest);
  }
  return m;
})();

export const findAdminByEmail = (email: string) =>
  adminUsers.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
export const findEmployeeByEmail = (email: string) =>
  employees.find((e) => e.email.toLowerCase() === email.trim().toLowerCase());
export const findTechnicianByEmail = (email: string) =>
  technicians.find((t) => t.email.toLowerCase() === email.trim().toLowerCase());
