import type {
  Alert,
  ContactPerson,
  Device,
  DeviceType,
  Distributor,
  Employee,
  MaintenanceTicket,
  Outlet,
  Reading,
  Sensor,
  Technician,
} from '@monitoring/types';
import type { Endpoints } from './endpoints';

/** Everything a signed-in app holds in memory, in the shape the pages already read. */
export interface Snapshot {
  distributors: Distributor[];
  outlets: Outlet[];
  deviceTypes: DeviceType[];
  devices: Device[];
  sensors: Sensor[];
  employees: Employee[];
  contacts: ContactPerson[];
  technicians: Technician[];
  tickets: MaintenanceTicket[];
  alerts: Alert[];
  latestReadings: Reading[];
}

/**
 * Loads the tenant in one round of parallel calls. The API scopes every list to the session, so
 * an employee token brings back only their own outlets without the caller asking for it.
 */
export async function loadSnapshot(api: Endpoints): Promise<Snapshot> {
  const [distributor, outlets, deviceTypes, devices, sensors, employees, contacts, technicians, tickets, alerts, latestReadings] =
    await Promise.all([
      api.distributor.get(),
      api.outlets.list(),
      api.deviceTypes.list(),
      api.devices.list(),
      api.sensors.list(),
      api.employees.list(),
      api.contacts.list(),
      api.technicians.list(),
      api.tickets.list(),
      api.alerts.list(),
      api.readings.latest(),
    ]);

  return {
    distributors: [distributor],
    outlets,
    deviceTypes,
    devices,
    sensors,
    employees,
    contacts,
    technicians,
    tickets,
    alerts: [...alerts].sort((a, b) => Date.parse(b.triggerTime) - Date.parse(a.triggerTime)),
    latestReadings,
  };
}
