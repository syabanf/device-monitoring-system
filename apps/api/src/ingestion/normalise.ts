import type { AlertEvent } from '@monitoring/integration';
import type { Db } from '../db/client';

export interface Resolved {
  distributorId: string;
  outletId: string;
  deviceId: string;
  sensorId: string;
  sensorName: string;
  sensorType: AlertEvent['sensorType'];
}

const norm = (v: string | null | undefined) => (v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Matches an inbound event to master data: MAC first because it never changes, then the
 * serial printed on the unit, then the outlet name the installer typed into the cloud.
 */
export async function resolveEvent(db: Db, event: AlertEvent): Promise<Resolved | { reason: string }> {
  const device =
    (event.mac ? await db.device.findUnique({ where: { mac: event.mac.toUpperCase() } }) : null) ??
    (event.deviceSerial ? await db.device.findUnique({ where: { serial: event.deviceSerial } }) : null) ??
    (await matchByName(db, event.deviceName));

  if (!device) {
    return { reason: `No device matches serial "${event.deviceSerial ?? '-'}", MAC "${event.mac ?? '-'}" or name "${event.deviceName}"` };
  }

  const sensors = await db.sensor.findMany({ where: { deviceId: device.id } });
  if (sensors.length === 0) return { reason: `Device ${device.serial} has no sensors configured` };

  const wanted = norm(event.sensorName.split('/')[0]);
  const sensor =
    sensors.find((s) => norm(s.name) === wanted) ??
    sensors.find((s) => wanted.includes(norm(s.name)) || norm(s.name).includes(wanted)) ??
    sensors.find((s) => s.type === event.sensorType) ??
    sensors[0]!;

  return {
    distributorId: device.distributorId,
    outletId: device.outletId,
    deviceId: device.id,
    sensorId: sensor.id,
    sensorName: sensor.name,
    sensorType: sensor.type,
  };
}

async function matchByName(db: Db, deviceName: string) {
  if (!deviceName) return null;
  const outlets = await db.outlet.findMany({ select: { id: true, name: true } });
  const hit = outlets.find((o) => norm(deviceName).includes(norm(o.name.replace('Indomaret', 'IDM'))) || norm(deviceName).includes(norm(o.name)));
  return hit ? db.device.findFirst({ where: { outletId: hit.id }, orderBy: { installedAt: 'asc' } }) : null;
}
