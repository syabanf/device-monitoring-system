import type { Device, Sensor } from '@monitoring/types';
import { Prisma } from '@prisma/client';
import type { Db } from '../../db/client';
import { toDevice, toSensor } from '../../db/map';
import { decodeCursor, toPage } from '../../lib/pagination';

export const devicesRepo = (db: Db, tenant: string) => ({
  async list(opts: { cursor?: string; limit: number; outletId?: string; status?: 'online' | 'offline' }) {
    const after = decodeCursor(opts.cursor);
    const rows = await db.device.findMany({
      where: { distributorId: tenant, ...(opts.outletId ? { outletId: opts.outletId } : {}), ...(opts.status ? { status: opts.status } : {}), ...(after ? { serial: { gt: after } } : {}) },
      orderBy: { serial: 'asc' },
      take: opts.limit + 1,
    });
    const paged = toPage(rows, opts.limit, (r) => r.serial);
    return { items: paged.items.map(toDevice), nextCursor: paged.nextCursor };
  },

  async find(deviceId: string): Promise<Device | null> {
    const row = await db.device.findFirst({ where: { id: deviceId, distributorId: tenant } });
    return row ? toDevice(row) : null;
  },

  async sensorsOf(deviceId: string): Promise<Sensor[]> {
    const rows = await db.sensor.findMany({ where: { deviceId, distributorId: tenant }, orderBy: [{ portKind: 'asc' }, { portIndex: 'asc' }] });
    return rows.map(toSensor);
  },

  /** Device and its sensors land together so a half-registered unit never reaches the floor plan. */
  async createWithSensors(device: Device, sensors: Sensor[]): Promise<{ device: Device; sensors: Sensor[] }> {
    await db.$transaction([
      db.device.create({
        data: {
          id: device.id, distributorId: tenant, outletId: device.outletId, deviceTypeId: device.deviceTypeId, model: device.model,
          serial: device.serial, mac: device.mac, ip: device.ip, firmware: device.firmware, status: device.status,
          lastPushAt: new Date(device.lastPushAt), installedAt: new Date(device.installedAt), pushIntervalSec: device.pushIntervalSec,
          ports: device.ports as unknown as Prisma.InputJsonValue, channels: device.channels,
          warrantyUntil: new Date(device.warrantyUntil), lastMaintenanceAt: device.lastMaintenanceAt ? new Date(device.lastMaintenanceAt) : null,
          nextMaintenanceAt: new Date(device.nextMaintenanceAt), uptimePct: device.uptimePct, sensorFaults: device.sensorFaults,
          floorX: device.floor.x, floorY: device.floor.y,
        },
      }),
      ...sensors.map((s) => db.sensor.create({
        data: {
          id: s.id, distributorId: tenant, deviceId: s.deviceId, outletId: s.outletId, name: s.name, type: s.type,
          portKind: s.portKind, portIndex: s.portIndex, unit: s.unit, thresholds: s.thresholds ? (s.thresholds as Prisma.InputJsonValue) : Prisma.DbNull,
          enabled: s.enabled, floorX: s.floor.x, floorY: s.floor.y,
        },
      })),
    ]);
    return { device, sensors };
  },

  async remove(deviceId: string): Promise<void> {
    await db.device.delete({ where: { id: deviceId } });
  },

  async upsertSensor(sensor: Sensor): Promise<Sensor> {
    const data = {
      distributorId: tenant, deviceId: sensor.deviceId, outletId: sensor.outletId, name: sensor.name, type: sensor.type,
      portKind: sensor.portKind, portIndex: sensor.portIndex, unit: sensor.unit, thresholds: sensor.thresholds ? (sensor.thresholds as Prisma.InputJsonValue) : Prisma.DbNull,
      enabled: sensor.enabled, floorX: sensor.floor.x, floorY: sensor.floor.y,
    };
    return toSensor(await db.sensor.upsert({ where: { id: sensor.id }, create: { id: sensor.id, ...data }, update: data }));
  },
});
