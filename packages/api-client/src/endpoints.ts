import type {
  Alert,
  AlertStatus,
  Channel,
  ContactPerson,
  Device,
  DeviceType,
  Distributor,
  Employee,
  MaintenanceTicket,
  Outlet,
  Reading,
  Sensor,
  SensorType,
  Session,
  Technician,
  TicketPriority,
  TicketStatus,
} from '@monitoring/types';
import type { ApiClient } from './client';

/** What the API answers on a successful login. */
export interface LoginResult {
  accessToken: string;
  expiresInSec: number;
  session: {
    sub: string;
    kind: Session['kind'];
    distributorId: string;
    outletIds?: string[];
    role?: string;
    name: string;
    email: string;
  };
}

export const auth = {
  adminLogin: (api: ApiClient, email: string, password: string) =>
    api.request<LoginResult>('POST', '/auth/admin/login', { email, password }),
  tokenLogin: (api: ApiClient, email: string, token: string) =>
    api.request<LoginResult>('POST', '/auth/token/login', { email, token }),
};

export type OutletInput = Omit<Outlet, 'id' | 'distributorId'>;
export type DeviceTypeInput = Omit<DeviceType, 'id'>;
export type TechnicianInput = Omit<Technician, 'id' | 'distributorId' | 'registrationToken'>;
export type ContactInput = Omit<ContactPerson, 'id'>;
export type EmployeeInput = Pick<Employee, 'name' | 'phone' | 'email' | 'role' | 'outletIds' | 'primaryOutletId' | 'avatarColor'>;

export interface DeviceCreateInput {
  outletId: string;
  deviceTypeId: string;
  serial?: string;
  ip?: string;
  sensorTypes: SensorType[];
}

export type DeviceUpdateInput = Pick<
  Device,
  'outletId' | 'ip' | 'firmware' | 'status' | 'pushIntervalSec' | 'warrantyUntil' | 'lastMaintenanceAt' | 'nextMaintenanceAt' | 'sensorFaults' | 'floor' | 'channels'
>;

export type SensorInput = Omit<Sensor, 'id' | 'deviceId' | 'outletId'>;

/** The device endpoints answer with the unit and its sensors together. */
export interface DeviceWithSensors {
  device: Device;
  sensors: Sensor[];
}

export interface TicketCreateInput {
  outletId: string;
  deviceId: string;
  sensorId: string | null;
  type: MaintenanceTicket['type'];
  priority: TicketPriority;
  title: string;
  description: string;
  technicianId: string | null;
  scheduledAt: string | null;
}

export interface TicketPatchInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  technicianId?: string | null;
  scheduledAt?: string | null;
  notes?: string;
  partsUsed?: string[];
  photoUrls?: string[];
}

/** What the AKCP subscriber in the API reports about its broker connection. Read only: the
 *  broker lives in the API environment, so the page shows the connection instead of a form. */
export interface MqttStatus {
  enabled: boolean;
  connected: boolean;
  brokerUrl: string;
  clientId: string;
  topicFilter: string;
  received: number;
  stored: number;
  unmatched: number;
  dropped: number;
  lastMessageAt: string | null;
  lastError?: string;
}

export interface IntegrationConfigView {
  apiBaseUrl: string;
  webhookPath: string;
  roomAlert: { accountEmail: string; pushIntervalSec: number; enabled: boolean };
  imap: { host: string; port: number; user: string; folder: string; pollSec: number; enabled: boolean };
  telegram: { botToken: string; chatId: string; enabled: boolean };
  push: { provider: 'fcm' | 'webpush'; enabled: boolean };
  telegramTokenSet: boolean;
  mqtt: MqttStatus;
  updatedAt: string;
}

export interface RequestLogEntry {
  id: string;
  at: string;
  direction: 'inbound' | 'outbound';
  channel: 'roomalert' | 'akcp' | 'email' | 'telegram' | 'push' | 'api';
  method: string;
  path: string;
  status: number;
  ms: number;
  summary: string;
}

export interface UnmatchedEvent {
  id: string;
  at: string;
  source: string;
  reason: string;
  raw: string;
}

export interface StatsSummary {
  period: string;
  from: string;
  alertsByStatus: Record<string, number>;
  open: number;
  solved: number;
  total: number;
  avgResponseSec: number | null;
  responseRate: number | null;
  perDay: { day: string; COMFORT: number; SECURITY: number; total: number }[];
  byOutlet: { outletId: string; avgSec: number; count: number }[];
  devices: { total: number; online: number; offline: number };
  tickets: { open: number; overdue: number; done: number };
  pendingAccounts: number;
}

export interface SeriesQuery {
  sensorId?: string;
  outletId?: string;
  from?: string;
  to?: string;
  bucket?: 'hour' | 'day' | '15m';
  limit?: number;
}

/** Every call the two frontends make, grouped the way the pages use them. */
export function endpoints(api: ApiClient, distributorId: string) {
  const tenant = `/distributors/${distributorId}`;
  return {
    distributor: {
      get: () => api.request<Distributor & { outlets: number }>('GET', tenant),
      update: (input: Pick<Distributor, 'code' | 'name' | 'region' | 'city' | 'address'>) =>
        api.request<Distributor>('PUT', tenant, input),
    },
    outlets: {
      list: () => api.list<Outlet>(`${tenant}/outlets`),
      create: (input: OutletInput) => api.request<Outlet>('POST', `${tenant}/outlets`, input),
      update: (id: string, input: OutletInput) => api.request<Outlet>('PUT', `${tenant}/outlets/${id}`, input),
      remove: (id: string) => api.request<void>('DELETE', `${tenant}/outlets/${id}`),
    },
    deviceTypes: {
      list: () => api.list<DeviceType>('/device-types'),
      create: (input: DeviceTypeInput) => api.request<DeviceType>('POST', '/device-types', input),
      update: (id: string, input: DeviceTypeInput) => api.request<DeviceType>('PUT', `/device-types/${id}`, input),
      remove: (id: string) => api.request<void>('DELETE', `/device-types/${id}`),
    },
    devices: {
      list: () => api.list<Device>(`${tenant}/devices`),
      get: (id: string) => api.request<DeviceWithSensors>('GET', `${tenant}/devices/${id}`),
      create: (input: DeviceCreateInput) => api.request<DeviceWithSensors>('POST', `${tenant}/devices`, input),
      update: (id: string, input: DeviceUpdateInput) =>
        api.request<DeviceWithSensors>('PUT', `${tenant}/devices/${id}`, input),
      remove: (id: string) => api.request<void>('DELETE', `${tenant}/devices/${id}`),
      saveSensor: (deviceId: string, sensorId: string, input: SensorInput) =>
        api.request<Sensor>('PUT', `${tenant}/devices/${deviceId}/sensors/${sensorId}`, input),
      removeSensor: (deviceId: string, sensorId: string) =>
        api.request<void>('DELETE', `${tenant}/devices/${deviceId}/sensors/${sensorId}`),
    },
    sensors: {
      list: () => api.request<{ items: Sensor[] }>('GET', `${tenant}/sensors`).then((p) => p.items),
    },
    employees: {
      list: () => api.list<Employee>(`${tenant}/employees`),
      create: (input: EmployeeInput) => api.request<Employee>('POST', `${tenant}/employees`, input),
      update: (id: string, input: EmployeeInput) => api.request<Employee>('PUT', `${tenant}/employees/${id}`, input),
      remove: (id: string) => api.request<void>('DELETE', `${tenant}/employees/${id}`),
      approve: (id: string) => api.request<Employee>('POST', `${tenant}/employees/${id}/approve`, {}),
      issueToken: (id: string) => api.request<Employee>('POST', `${tenant}/employees/${id}/token`, {}),
      revoke: (id: string) => api.request<Employee>('POST', `${tenant}/employees/${id}/revoke`, {}),
    },
    technicians: {
      list: () => api.list<Technician>(`${tenant}/technicians`),
      create: (input: TechnicianInput) => api.request<Technician>('POST', `${tenant}/technicians`, input),
      update: (id: string, input: TechnicianInput) =>
        api.request<Technician>('PUT', `${tenant}/technicians/${id}`, input),
      remove: (id: string) => api.request<void>('DELETE', `${tenant}/technicians/${id}`),
      issueToken: (id: string) => api.request<Technician>('POST', `${tenant}/technicians/${id}/token`, {}),
    },
    contacts: {
      list: () => api.list<ContactPerson>(`${tenant}/contact-persons`),
      create: (input: ContactInput) => api.request<ContactPerson>('POST', `${tenant}/contact-persons`, input),
      update: (id: string, input: ContactInput) =>
        api.request<ContactPerson>('PUT', `${tenant}/contact-persons/${id}`, input),
      remove: (id: string) => api.request<void>('DELETE', `${tenant}/contact-persons/${id}`),
    },
    alerts: {
      list: (query?: { outletId?: string; status?: string; since?: string }) =>
        api.list<Alert>(`${tenant}/alerts`, query),
      get: (id: number) => api.request<Alert>('GET', `/alerts/${id}`),
      setStatus: (id: number, status: AlertStatus, clearValue?: string) =>
        api.request<Alert>('POST', `/alerts/${id}/status`, { status, clearValue }),
      respond: (id: number, notes: string, photoUrls: string[]) =>
        api.request<Alert>('POST', `/alerts/${id}/respond`, { notes, photoUrls }),
    },
    tickets: {
      list: () => api.list<MaintenanceTicket>(`${tenant}/tickets`),
      create: (input: TicketCreateInput) => api.request<MaintenanceTicket>('POST', `${tenant}/tickets`, input),
      patch: (id: string, input: TicketPatchInput) =>
        api.request<MaintenanceTicket>('PATCH', `${tenant}/tickets/${id}`, input),
    },
    readings: {
      latest: (outletId?: string) =>
        api.request<{ items: Reading[] }>('GET', `${tenant}/readings/latest`, undefined, { outletId }).then((p) => p.items),
      series: (query: SeriesQuery) =>
        api
          .request<{ items: Reading[] }>('GET', `${tenant}/readings`, undefined, { ...query })
          .then((p) => p.items),
    },
    stats: {
      summary: (period: 'today' | '7d' | '30d' | 'all') =>
        api.request<StatsSummary>('GET', `${tenant}/stats`, undefined, { period }),
    },
    integration: {
      get: () => api.request<IntegrationConfigView>('GET', `${tenant}/integration`),
      save: (config: Omit<IntegrationConfigView, 'telegramTokenSet' | 'mqtt' | 'updatedAt'>) =>
        api.request<IntegrationConfigView>('PUT', `${tenant}/integration`, config),
      log: (channel?: string) =>
        api.request<{ items: RequestLogEntry[] }>('GET', `${tenant}/integration/request-log`, undefined, { channel, limit: 200 }).then((p) => p.items),
      unmatched: () =>
        api.request<{ items: UnmatchedEvent[] }>('GET', `${tenant}/integration/unmatched`, undefined, { limit: 100 }).then((p) => p.items),
      test: (channel: string) =>
        api.request<{ ok: boolean; ms: number; message: string }>('POST', `${tenant}/integration/test/${channel}`, {}),
    },
    health: () => api.request<{ ok: boolean; version: string; uptimeSec: number; db: string; queue: string }>('GET', '/health'),
  };
}

export type Endpoints = ReturnType<typeof endpoints>;
export type { Channel };
