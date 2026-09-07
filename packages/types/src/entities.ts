import type {
  AlertCategory,
  AlertStatus,
  Channel,
  DeviceModel,
  DeviceStatus,
  EmployeeRole,
  MaintenanceType,
  PortKind,
  RegistrationStatus,
  SensorType,
  TicketPriority,
  TicketStatus,
} from './enums';

export interface Distributor {
  id: string;
  code: string;
  name: string;
  region: string;
  city: string;
  address: string;
  adminUserId: string;
}

export interface Outlet {
  id: string;
  distributorId: string;
  code: string;
  name: string;
  address: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  openTime: string;
  closeTime: string;
  timezone: string;
  phone: string;
}

export interface DeviceTypePort {
  kind: PortKind;
  count: number;
}

export interface DeviceType {
  id: string;
  model: DeviceModel;
  name: string;
  vendor: string;
  ports: DeviceTypePort[];
  builtInSensors: SensorType[];
  description: string;
  priceIdr: number;
  latestFirmware: string;
  maintenanceIntervalDays: number;
}

/** Position on the outlet floor plan, percent of width/height (0-100). */
export interface FloorPoint {
  x: number;
  y: number;
}

export interface DevicePort {
  index: number;
  kind: PortKind;
  label: string;
  sensorId: string | null;
}

export interface Device {
  id: string;
  outletId: string;
  deviceTypeId: string;
  model: DeviceModel;
  serial: string;
  mac: string;
  ip: string;
  firmware: string;
  status: DeviceStatus;
  lastPushAt: string;
  installedAt: string;
  pushIntervalSec: number;
  ports: DevicePort[];
  channels: Channel[];
  warrantyUntil: string;
  lastMaintenanceAt: string | null;
  nextMaintenanceAt: string;
  uptimePct: number;
  sensorFaults: number;
  floor: FloorPoint;
}

export interface SensorThresholds {
  min?: number;
  max?: number;
  humidityMin?: number;
  humidityMax?: number;
}

export interface Sensor {
  id: string;
  deviceId: string;
  outletId: string;
  name: string;
  type: SensorType;
  portKind: PortKind;
  portIndex: number;
  unit: '°C' | '%RH' | 'state';
  thresholds?: SensorThresholds;
  enabled: boolean;
  floor: FloorPoint;
}

/** Compact reading tuple: [sensorId, isoTime, temperatureC, humidityPct] */
export type ReadingTuple = [string, string, number, number];

export interface Reading {
  sensorId: string;
  at: string;
  temperatureC: number;
  humidityPct: number;
}

export interface Employee {
  id: string;
  distributorId: string;
  outletIds: string[];
  primaryOutletId: string;
  name: string;
  phone: string;
  email: string;
  role: EmployeeRole;
  registrationToken: string | null;
  registrationStatus: RegistrationStatus;
  registeredAt: string | null;
  approvedAt: string | null;
  avatarColor: string;
}

export interface ContactPerson {
  id: string;
  outletId: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  isPrimary: boolean;
  channels: Channel[];
}

export interface AdminUser {
  id: string;
  distributorId: string;
  name: string;
  email: string;
  role: 'admin';
  avatarColor: string;
}

export interface AlertResponse {
  employeeId: string;
  notes: string;
  photoUrls: string[];
  respondedAt: string;
  responseDurationSec: number;
}

export interface Alert {
  id: number;
  distributorId: string;
  outletId: string;
  deviceId: string;
  sensorId: string;
  sensorName: string;
  sensorType: SensorType;
  category: AlertCategory;
  status: AlertStatus;
  triggerValue: string;
  triggerTime: string;
  clearValue: string | null;
  clearTime: string | null;
  message: string;
  response: AlertResponse | null;
  channels: Channel[];
}

export interface Session {
  kind: 'admin' | 'employee' | 'technician';
  userId: string;
  distributorId: string;
  loggedInAt: string;
}

export interface FixtureMeta {
  seed: number;
  fixtureNow: string;
  generatedAt: string;
}

export interface Technician {
  id: string;
  distributorId: string;
  name: string;
  phone: string;
  specialty: string;
  avatarColor: string;
  email: string;
  registrationToken: string;
}

export interface MaintenanceTicket {
  id: string;
  distributorId: string;
  outletId: string;
  deviceId: string;
  sensorId: string | null;
  type: MaintenanceType;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  description: string;
  technicianId: string | null;
  createdAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  partsUsed: string[];
  notes: string | null;
  photoUrls: string[];
}
