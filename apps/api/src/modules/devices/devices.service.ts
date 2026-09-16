import type { DeviceInput, SensorInput } from '@monitoring/contracts';
import type { Device, DevicePort, Sensor, SensorType } from '@monitoring/types';
import type { Db } from '../../db/client';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Ctx } from '../../plugins/auth';
import { devicesRepo } from './devices.repo';

/** The standard Indomaret outlet loadout, the same list the admin dialog offers. */
const DEFAULT_SENSORS: { type: SensorType; name: string; portKind: 'digital' | 'switch'; x: number; y: number }[] = [
  { type: 'TEMPERATURE_HUMIDITY', name: 'Sales Area Temp & RH', portKind: 'digital', x: 50, y: 52 },
  { type: 'DOOR', name: 'Front Door', portKind: 'switch', x: 50, y: 91 },
  { type: 'MOTION', name: 'Sales Area Motion', portKind: 'switch', x: 52, y: 36 },
  { type: 'POWER', name: 'Main Power', portKind: 'switch', x: 92, y: 40 },
  { type: 'PANIC_BUTTON', name: 'Cashier Panic Button', portKind: 'switch', x: 84, y: 86 },
];
const hex = () => Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');

export const devicesService = (db: Db, ctx: Ctx) => {
  const repo = devicesRepo(db, ctx.tenant);
  return {
    list: repo.list,

    async get(deviceId: string): Promise<{ device: Device; sensors: Sensor[] }> {
      const device = await repo.find(deviceId);
      if (!device) throw notFound('Device', deviceId);
      return { device, sensors: await repo.sensorsOf(deviceId) };
    },

    /** Registers the unit, lays out its ports and places the chosen sensors on the floor plan. */
    async create(input: DeviceInput): Promise<{ device: Device; sensors: Sensor[] }> {
      const outlet = await db.outlet.findFirst({ where: { id: input.outletId, distributorId: ctx.tenant }, select: { id: true } });
      if (!outlet) throw notFound('Outlet', input.outletId);
      const type = await db.deviceType.findUnique({ where: { id: input.deviceTypeId } });
      if (!type) throw notFound('Device type', input.deviceTypeId);
      if (input.serial) {
        const clash = await db.device.findUnique({ where: { serial: input.serial }, select: { id: true } });
        if (clash) throw conflict('SERIAL_TAKEN', `Serial ${input.serial} is already registered`);
      }

      const typePorts = type.ports as unknown as { kind: DevicePort['kind']; count: number }[];
      const capacity = Object.fromEntries(typePorts.map((p) => [p.kind, p.count])) as Record<string, number>;
      const ports: DevicePort[] = typePorts.flatMap((p) =>
        Array.from({ length: p.count }, (_, i) => ({ index: i + 1, kind: p.kind, label: `${p.kind[0]!.toUpperCase()}${p.kind.slice(1)} ${i + 1}`, sensorId: null })),
      );

      const deviceId = newId('dev');
      const used: Record<string, number> = { digital: 0, switch: 0 };
      const sensors: Sensor[] = [];
      for (const spec of DEFAULT_SENSORS.filter((s) => input.sensorTypes.includes(s.type))) {
        if ((used[spec.portKind] ?? 0) >= (capacity[spec.portKind] ?? 0)) {
          throw badRequest('PORT_CAPACITY_EXCEEDED', `${type.name} has no free ${spec.portKind} port for ${spec.name}`);
        }
        used[spec.portKind] = (used[spec.portKind] ?? 0) + 1;
        const sensorId = newId('sen');
        const port = ports.find((p) => p.kind === spec.portKind && p.index === used[spec.portKind]);
        if (port) port.sensorId = sensorId;
        sensors.push({
          id: sensorId, deviceId, outletId: input.outletId, name: spec.name, type: spec.type, portKind: spec.portKind,
          portIndex: used[spec.portKind]!, unit: spec.type === 'TEMPERATURE_HUMIDITY' ? '°C' : 'state',
          thresholds: spec.type === 'TEMPERATURE_HUMIDITY' ? { min: 18, max: 28, humidityMin: 30, humidityMax: 60 } : undefined,
          enabled: true, floor: { x: spec.x, y: spec.y },
        });
      }

      const existing = await db.device.count({ where: { outletId: input.outletId } });
      const now = ctx.now.toISOString();
      const device: Device = {
        id: deviceId, outletId: input.outletId, deviceTypeId: type.id, model: type.model,
        serial: input.serial?.trim() || `${type.model.replace(/S$/, '')}-F${Math.floor(60000 + Math.random() * 39999)}-${type.model}`,
        mac: `00:80:A3:${hex()}:${hex()}:${hex()}`,
        ip: input.ip?.trim() || `192.168.${10 + Math.floor(Math.random() * 50)}.${20 + Math.floor(Math.random() * 230)}`,
        firmware: type.latestFirmware, status: 'online', lastPushAt: now, installedAt: now, pushIntervalSec: 300,
        ports, channels: ['app'],
        warrantyUntil: new Date(ctx.now.getTime() + 3 * 365 * 86_400_000).toISOString(),
        lastMaintenanceAt: null,
        nextMaintenanceAt: new Date(ctx.now.getTime() + type.maintenanceIntervalDays * 86_400_000).toISOString(),
        uptimePct: 100, sensorFaults: 0, floor: { x: 91, y: existing > 0 ? 24 : 60 },
      };
      return repo.createWithSensors(device, sensors);
    },

    async remove(deviceId: string): Promise<void> {
      if (!(await repo.find(deviceId))) throw notFound('Device', deviceId);
      await repo.remove(deviceId);
    },

    /** The unique index on (deviceId, portKind, portIndex) is what actually guards the port. */
    async upsertSensor(deviceId: string, sensorId: string, input: SensorInput): Promise<Sensor> {
      const device = await repo.find(deviceId);
      if (!device) throw notFound('Device', deviceId);
      const occupied = await db.sensor.findFirst({
        where: { deviceId, portKind: input.portKind, portIndex: input.portIndex, NOT: { id: sensorId } },
        select: { id: true, name: true },
      });
      if (occupied) throw conflict('PORT_ALREADY_USED', `${input.portKind} port ${input.portIndex} already holds ${occupied.name}`);
      return repo.upsertSensor({ ...input, id: sensorId, deviceId, outletId: device.outletId });
    },
  };
};
