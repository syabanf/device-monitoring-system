import { z } from 'zod';
import type { Alert, ContactPerson, Device, DeviceType, Distributor, Employee, MaintenanceTicket, Outlet, Reading, Sensor, Technician } from '@monitoring/types';
import { id, isoDateTime } from './primitives';

export const sensorType = z.enum(['TEMPERATURE', 'TEMPERATURE_HUMIDITY', 'DOOR', 'MOTION', 'POWER', 'PANIC_BUTTON']);
export const portKind = z.enum(['digital', 'switch', 'analog']);
export const deviceModel = z.enum(['RA3S', 'RA12S']);
export const deviceStatus = z.enum(['online', 'offline']);
export const alertStatus = z.enum(['UNACKNOWLEDGED', 'ACKNOWLEDGED', 'RESPONDING', 'RESOLVED', 'VERIFIED']);
export const alertCategory = z.enum(['COMFORT', 'SECURITY']);
export const registrationStatus = z.enum(['pending', 'approved']);
export const employeeRole = z.enum(['store_manager', 'assistant_manager', 'cashier', 'staff']);
export const channel = z.enum(['app', 'telegram']);
export const maintenanceType = z.enum(['PREVENTIVE', 'CORRECTIVE', 'REPLACEMENT', 'INSTALLATION', 'FIRMWARE']);
export const ticketStatus = z.enum(['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'DONE']);
export const ticketPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const floorPoint = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) });

export const distributorSchema: z.ZodType<Distributor> = z.object({
  id: id('dst'), code: z.string(), name: z.string(), region: z.string(), city: z.string(), address: z.string(), adminUserId: id('adm'),
});

const outletShape = {
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string(),
  city: z.string(),
  province: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  mapsUrl: z.string(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
  phone: z.string(),
};
export const outletSchema: z.ZodType<Outlet> = z.object({ id: id('out'), distributorId: id('dst'), ...outletShape });
/** Everything the client may send; the server owns id and distributorId. */
export const outletInput = z.object(outletShape);
export type OutletInput = z.infer<typeof outletInput>;

export const deviceTypeSchema: z.ZodType<DeviceType> = z.object({
  id: id('dt'), model: deviceModel, name: z.string(), vendor: z.string(),
  ports: z.array(z.object({ kind: portKind, count: z.number().int().min(0) })),
  builtInSensors: z.array(sensorType),
  description: z.string(), priceIdr: z.number().int().min(0), latestFirmware: z.string(), maintenanceIntervalDays: z.number().int().min(1),
});

export const deviceSchema: z.ZodType<Device> = z.object({
  id: id('dev'), outletId: id('out'), deviceTypeId: id('dt'), model: deviceModel,
  serial: z.string().min(1), mac: z.string(), ip: z.string(), firmware: z.string(),
  status: deviceStatus, lastPushAt: isoDateTime, installedAt: isoDateTime, pushIntervalSec: z.number().int().min(30),
  ports: z.array(z.object({ index: z.number().int().min(1), kind: portKind, label: z.string(), sensorId: id('sen').nullable() })),
  channels: z.array(channel),
  warrantyUntil: isoDateTime, lastMaintenanceAt: isoDateTime.nullable(), nextMaintenanceAt: isoDateTime,
  uptimePct: z.number().min(0).max(100), sensorFaults: z.number().int().min(0), floor: floorPoint,
});
export const deviceInput = z.object({
  outletId: id('out'),
  deviceTypeId: id('dt'),
  serial: z.string().min(1).optional(),
  ip: z.string().optional(),
  sensorTypes: z.array(sensorType).default([]),
});
export type DeviceInput = z.infer<typeof deviceInput>;

const sensorShape = {
  name: z.string().min(1),
  type: sensorType,
  portKind,
  portIndex: z.number().int().min(1),
  unit: z.enum(['°C', '%RH', 'state']),
  thresholds: z.object({ min: z.number().optional(), max: z.number().optional(), humidityMin: z.number().optional(), humidityMax: z.number().optional() }).optional(),
  enabled: z.boolean(),
  floor: floorPoint,
};
export const sensorSchema: z.ZodType<Sensor> = z.object({ id: id('sen'), deviceId: id('dev'), outletId: id('out'), ...sensorShape });
export const sensorInput = z.object(sensorShape);
export type SensorInput = z.infer<typeof sensorInput>;

export const alertResponseSchema = z.object({
  employeeId: id('emp'), notes: z.string(), photoUrls: z.array(z.string()), respondedAt: isoDateTime, responseDurationSec: z.number().int().min(0),
});

export const alertSchema: z.ZodType<Alert> = z.object({
  id: z.number().int(), distributorId: id('dst'), outletId: id('out'), deviceId: id('dev'), sensorId: id('sen'),
  sensorName: z.string(), sensorType, category: alertCategory, status: alertStatus,
  triggerValue: z.string(), triggerTime: isoDateTime, clearValue: z.string().nullable(), clearTime: isoDateTime.nullable(),
  message: z.string(), response: alertResponseSchema.nullable(), channels: z.array(channel),
  assigneeEmployeeId: id('emp').nullable().optional(),
  acknowledgedAt: isoDateTime.nullable().optional(),
  respondingAt: isoDateTime.nullable().optional(),
  resolvedAt: isoDateTime.nullable().optional(),
  verifiedAt: isoDateTime.nullable().optional(),
});

export const ticketSchema: z.ZodType<MaintenanceTicket> = z.object({
  id: id('MT'), distributorId: id('dst'), outletId: id('out'), deviceId: id('dev'), sensorId: id('sen').nullable(),
  type: maintenanceType, priority: ticketPriority, status: ticketStatus,
  title: z.string().min(1), description: z.string(), technicianId: id('tech').nullable(),
  createdAt: isoDateTime, scheduledAt: isoDateTime.nullable(), completedAt: isoDateTime.nullable(),
  partsUsed: z.array(z.string()), notes: z.string().nullable(), photoUrls: z.array(z.string()),
});
export const ticketInput = z.object({
  outletId: id('out'), deviceId: id('dev'), sensorId: id('sen').nullable().default(null),
  type: maintenanceType, priority: ticketPriority, title: z.string().min(1), description: z.string().default(''),
  technicianId: id('tech').nullable().default(null), scheduledAt: isoDateTime.nullable().default(null),
});
export const ticketPatch = z.object({
  status: ticketStatus.optional(), technicianId: id('tech').nullable().optional(), scheduledAt: isoDateTime.nullable().optional(),
  priority: ticketPriority.optional(), notes: z.string().optional(), partsUsed: z.array(z.string()).optional(), photoUrls: z.array(z.string()).optional(),
});
export type TicketInput = z.infer<typeof ticketInput>;
export type TicketPatch = z.infer<typeof ticketPatch>;

export const employeeSchema: z.ZodType<Employee> = z.object({
  id: id('emp'), distributorId: id('dst'), outletIds: z.array(id('out')), primaryOutletId: id('out'),
  name: z.string(), phone: z.string(), email: z.string().email(), role: employeeRole,
  registrationToken: z.string().nullable(), registrationStatus, registeredAt: isoDateTime.nullable(), approvedAt: isoDateTime.nullable(),
  avatarColor: z.string(),
});

export const technicianSchema: z.ZodType<Technician> = z.object({
  id: id('tech'), distributorId: id('dst'), name: z.string(), phone: z.string(), specialty: z.string(),
  avatarColor: z.string(), email: z.string().email(), registrationToken: z.string(),
});

export const contactPersonSchema: z.ZodType<ContactPerson> = z.object({
  id: id('cp'), outletId: id('out'), name: z.string(), phone: z.string(), email: z.string().email().nullable(),
  role: z.string(), isPrimary: z.boolean(), channels: z.array(channel),
});

export const readingSchema: z.ZodType<Reading> = z.object({
  sensorId: id('sen'), at: isoDateTime, temperatureC: z.number(), humidityPct: z.number(),
});
