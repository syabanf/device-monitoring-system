import type { AlertCategory, SensorType } from '@monitoring/types';

/** Normalised alert event coming out of the blackbox, independent of the source channel. */
export interface AlertEvent {
  source: 'webhook' | 'email' | 'manual';
  event: 'TRIGGERED' | 'CLEARED';
  externalAlertId: string | null;
  deviceName: string;
  deviceSerial: string | null;
  mac: string | null;
  location: string | null;
  sensorName: string;
  sensorType: SensorType;
  value: string;
  at: string;
  raw: string;
}

const TYPE_MAP: Record<string, SensorType> = {
  TEMPERATURE: 'TEMPERATURE',
  TEMPERATURE_HUMIDITY: 'TEMPERATURE_HUMIDITY',
  'TEMP & RH': 'TEMPERATURE_HUMIDITY',
  HUMIDITY: 'TEMPERATURE_HUMIDITY',
  DOOR: 'DOOR',
  SWITCH: 'DOOR',
  MOTION: 'MOTION',
  POWER: 'POWER',
  PANIC: 'PANIC_BUTTON',
  PANIC_BUTTON: 'PANIC_BUTTON',
};
function mapType(s: string | undefined): SensorType {
  if (!s) return 'TEMPERATURE';
  const key = s.trim().toUpperCase().replace(/\s+/g, '_');
  for (const [k, v] of Object.entries(TYPE_MAP)) if (key.includes(k.replace(/\s+/g, '_'))) return v;
  return 'TEMPERATURE';
}
export function categoryFor(type: SensorType, at: string): AlertCategory {
  if (type === 'TEMPERATURE' || type === 'TEMPERATURE_HUMIDITY') return 'COMFORT';
  const h = new Date(at).getHours();
  void h;
  return 'SECURITY';
}

/** Room Alert cloud HTTP POST (JSON) payload, as documented for the Room Alert account "HTTP POST" alert action. */
export interface RoomAlertWebhookPayload {
  alert_id?: string | number;
  event?: string; // "triggered" | "cleared"
  device?: { name?: string; serial?: string; mac?: string; location?: string };
  sensor?: { name?: string; type?: string; value?: string | number; unit?: string };
  timestamp?: string;
  [k: string]: unknown;
}

export function parseWebhook(json: string): AlertEvent {
  const p = JSON.parse(json) as RoomAlertWebhookPayload;
  const type = mapType(p.sensor?.type);
  const value = p.sensor?.value != null ? `${p.sensor.value}${p.sensor.unit ? ` ${p.sensor.unit}` : ''}` : '';
  return {
    source: 'webhook',
    event: String(p.event ?? 'triggered').toLowerCase().startsWith('clear') ? 'CLEARED' : 'TRIGGERED',
    externalAlertId: p.alert_id != null ? String(p.alert_id) : null,
    deviceName: p.device?.name ?? 'Unknown device',
    deviceSerial: p.device?.serial ?? null,
    mac: p.device?.mac ?? null,
    location: p.device?.location ?? null,
    sensorName: p.sensor?.name ?? 'Sensor',
    sensorType: type,
    value,
    at: p.timestamp ?? new Date().toISOString(),
    raw: json,
  };
}

/**
 * Room Alert alert e-mail / ANBot broadcast text, e.g.
 *   ❌ Alert TRIGGERED ❌
 *   Name : Jakarta RA3E-C65A34
 *   Location : Jl. Permata Intan ...
 *   Alert ID : 5728781
 *   Sensor Name : Sensor Temp&RH JKT / Ext Sensor 1
 *   Sensor Type : TEMPERATURE_HUMIDITY
 *   Trigger Alarm : 31.0600
 *   Trigger Time : 20-04-2022 07:56:02 WIB
 */
export function parseEmail(text: string): AlertEvent {
  const get = (label: string) => new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im').exec(text)?.[1]?.trim() ?? null;
  const cleared = /RESOLVED|CLEARED/i.test(text.split('\n')[0] ?? '') || /Clear Value/i.test(text);
  const type = mapType(get('Sensor Type') ?? undefined);
  const trigger = get('Trigger Alarm') ?? get('Trigger Value') ?? '';
  const clearValue = get('Clear Value');
  const time = get(cleared ? 'Clear Time' : 'Trigger Time') ?? '';
  const name = get('Name') ?? 'Unknown device';
  const serial = /\b(RA\d+[A-Z]?-[A-Z0-9]+)\b/i.exec(name)?.[1] ?? null;
  return {
    source: 'email',
    event: cleared ? 'CLEARED' : 'TRIGGERED',
    externalAlertId: get('Alert ID'),
    deviceName: name,
    deviceSerial: serial,
    mac: null,
    location: get('Location'),
    sensorName: get('Sensor Name') ?? 'Sensor',
    sensorType: type,
    value: (cleared ? clearValue : trigger) ?? '',
    at: parseIdDate(time) ?? new Date().toISOString(),
    raw: text,
  };
}
/** "20-04-2022 07:56:02 WIB" -> ISO with +07:00 */
function parseIdDate(s: string): string | null {
  const m = /(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return Date.parse(s) ? new Date(s).toISOString() : null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}+07:00`;
}

export function detectAndParse(input: string): AlertEvent {
  const t = input.trim();
  if (t.startsWith('{')) return parseWebhook(t);
  return parseEmail(t);
}

export const SAMPLE_WEBHOOK = JSON.stringify({
  alert_id: 5731122,
  event: 'triggered',
  device: { name: 'IDM Margorejo 1', serial: 'RA3-F88156-RA3S', mac: '00:80:A3:36:D1:DB', location: 'Jl. Margorejo No. 92, Surabaya' },
  sensor: { name: 'Sales Area Temp & RH', type: 'TEMPERATURE_HUMIDITY', value: 30.4, unit: '°C' },
  timestamp: '2026-09-07T13:28:00+07:00',
}, null, 2);

export const SAMPLE_EMAIL = `❌ Alert TRIGGERED ❌
Name : Surabaya RA3-F98909-RA3S
Location : Jl. Rungkut No. 45, Surabaya, Jawa Timur
Alert ID : 5731123
Sensor Name : Front Door / Ext Sensor 1
Sensor Type : SWITCH
Trigger Alarm : OPEN
Trigger Time : 07-09-2026 03:12:40 WIB`;
