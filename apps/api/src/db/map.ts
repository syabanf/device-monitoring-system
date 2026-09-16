import type { Alert, Device, DevicePort, MaintenanceTicket, Outlet, Sensor } from '@monitoring/types';
import type { Prisma } from '@prisma/client';

/** Prisma rows never leave the repo layer; these turn them into the shared domain types. */
const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

type OutletRow = Prisma.OutletGetPayload<object>;
type DeviceRow = Prisma.DeviceGetPayload<object>;
type SensorRow = Prisma.SensorGetPayload<object>;
type AlertRow = Prisma.AlertGetPayload<{ include: { response: true } }>;
type TicketRow = Prisma.MaintenanceTicketGetPayload<object>;

export const toOutlet = (r: OutletRow): Outlet => ({
  id: r.id, distributorId: r.distributorId, code: r.code, name: r.name, address: r.address, city: r.city, province: r.province,
  lat: r.lat, lng: r.lng, mapsUrl: r.mapsUrl, openTime: r.openTime, closeTime: r.closeTime, timezone: r.timezone, phone: r.phone,
});

export const toDevice = (r: DeviceRow): Device => ({
  id: r.id, outletId: r.outletId, deviceTypeId: r.deviceTypeId, model: r.model, serial: r.serial, mac: r.mac, ip: r.ip,
  firmware: r.firmware, status: r.status, lastPushAt: iso(r.lastPushAt), installedAt: iso(r.installedAt),
  pushIntervalSec: r.pushIntervalSec, ports: r.ports as unknown as DevicePort[], channels: r.channels,
  warrantyUntil: iso(r.warrantyUntil), lastMaintenanceAt: isoOrNull(r.lastMaintenanceAt), nextMaintenanceAt: iso(r.nextMaintenanceAt),
  uptimePct: r.uptimePct, sensorFaults: r.sensorFaults, floor: { x: r.floorX, y: r.floorY },
});

export const toSensor = (r: SensorRow): Sensor => ({
  id: r.id, deviceId: r.deviceId, outletId: r.outletId, name: r.name, type: r.type, portKind: r.portKind, portIndex: r.portIndex,
  unit: r.unit as Sensor['unit'], thresholds: (r.thresholds as Sensor['thresholds']) ?? undefined, enabled: r.enabled,
  floor: { x: r.floorX, y: r.floorY },
});

export const toAlert = (r: AlertRow): Alert => ({
  id: r.id, distributorId: r.distributorId, outletId: r.outletId, deviceId: r.deviceId, sensorId: r.sensorId,
  sensorName: r.sensorName, sensorType: r.sensorType, category: r.category, status: r.status,
  triggerValue: r.triggerValue, triggerTime: iso(r.triggerTime), clearValue: r.clearValue, clearTime: isoOrNull(r.clearTime),
  message: r.message, channels: r.channels,
  response: r.response
    ? { employeeId: r.response.employeeId, notes: r.response.notes, photoUrls: r.response.photoUrls, respondedAt: iso(r.response.respondedAt), responseDurationSec: r.response.responseDurationSec }
    : null,
  assigneeEmployeeId: r.assigneeEmployeeId, acknowledgedAt: isoOrNull(r.acknowledgedAt), respondingAt: isoOrNull(r.respondingAt),
  resolvedAt: isoOrNull(r.resolvedAt), verifiedAt: isoOrNull(r.verifiedAt),
});

export const toTicket = (r: TicketRow): MaintenanceTicket => ({
  id: r.id, distributorId: r.distributorId, outletId: r.outletId, deviceId: r.deviceId, sensorId: r.sensorId,
  type: r.type, priority: r.priority, status: r.status, title: r.title, description: r.description, technicianId: r.technicianId,
  createdAt: iso(r.createdAt), scheduledAt: isoOrNull(r.scheduledAt), completedAt: isoOrNull(r.completedAt),
  partsUsed: r.partsUsed, notes: r.notes, photoUrls: r.photoUrls,
});
