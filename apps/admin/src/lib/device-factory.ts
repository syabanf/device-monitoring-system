import type { Device, DeviceType, Sensor, SensorType } from '@monitoring/types';
import { nowIso, newId } from '@monitoring/fixtures';

export const DEFAULT_SENSORS: { type: SensorType; name: string; portKind: 'digital' | 'switch'; x: number; y: number }[] = [
  { type: 'TEMPERATURE_HUMIDITY', name: 'Sales Area Temp & RH', portKind: 'digital', x: 50, y: 52 },
  { type: 'DOOR', name: 'Front Door', portKind: 'switch', x: 50, y: 91 },
  { type: 'MOTION', name: 'Sales Area Motion', portKind: 'switch', x: 52, y: 36 },
  { type: 'POWER', name: 'Main Power', portKind: 'switch', x: 92, y: 40 },
  { type: 'PANIC_BUTTON', name: 'Cashier Panic Button', portKind: 'switch', x: 84, y: 86 },
];
const hex = () => Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');

export function buildDevice(opts: { outletId: string; type: DeviceType; serial?: string; ip?: string; sensorTypes: SensorType[]; secondary?: boolean }): { device: Device; sensors: Sensor[] } {
  const { outletId, type } = opts;
  const id = newId('dev');
  const ports: Device['ports'] = [];
  for (const p of type.ports) for (let i = 1; i <= p.count; i++) ports.push({ index: i, kind: p.kind, label: `${p.kind[0]!.toUpperCase()}${p.kind.slice(1)} ${i}`, sensorId: null });
  const capacity = { digital: type.ports.find((p) => p.kind === 'digital')?.count ?? 0, switch: type.ports.find((p) => p.kind === 'switch')?.count ?? 0 };
  const counters = { digital: 0, switch: 0 };
  const sensors: Sensor[] = [];
  for (const s of DEFAULT_SENSORS.filter((d) => opts.sensorTypes.includes(d.type))) {
    if (counters[s.portKind] >= capacity[s.portKind]) continue;
    counters[s.portKind]++;
    const sid = newId('sen');
    const port = ports.find((p) => p.kind === s.portKind && p.index === counters[s.portKind]);
    if (port) port.sensorId = sid;
    sensors.push({ id: sid, deviceId: id, outletId, name: s.name, type: s.type, portKind: s.portKind, portIndex: counters[s.portKind], unit: s.type === 'TEMPERATURE_HUMIDITY' ? '°C' : 'state', thresholds: s.type === 'TEMPERATURE_HUMIDITY' ? { min: 18, max: 28, humidityMin: 30, humidityMax: 60 } : undefined, enabled: true, floor: { x: s.x, y: s.y } });
  }
  const device: Device = {
    id, outletId, deviceTypeId: type.id, model: type.model, serial: opts.serial?.trim() || `${type.model.replace(/[SEW]$/, '')}-F${Math.floor(60000 + Math.random() * 39999)}-${type.model}`, mac: `00:80:A3:${hex()}:${hex()}:${hex()}`, ip: opts.ip?.trim() || `192.168.${10 + Math.floor(Math.random() * 50)}.${20 + Math.floor(Math.random() * 230)}`, firmware: type.latestFirmware, status: 'online', lastPushAt: nowIso(), installedAt: nowIso(), pushIntervalSec: 300, ports, channels: ['app'],
    warrantyUntil: '2029-09-07T00:00:00+07:00', lastMaintenanceAt: null, nextMaintenanceAt: '2027-03-06T00:00:00+07:00', uptimePct: 100, sensorFaults: 0, floor: { x: 91, y: opts.secondary ? 24 : 60 },
  };
  return { device, sensors };
}
