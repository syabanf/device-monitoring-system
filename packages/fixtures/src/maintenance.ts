import type { Device, HealthStatus, MaintenanceTicket } from '@monitoring/types';
import { deviceTypeById } from './accessors';
import { FIXTURE_NOW_MS } from './constants';

const DAY = 86_400_000;

export interface HealthIssue { code: 'offline' | 'firmware' | 'maintenance_overdue' | 'maintenance_due' | 'warranty' | 'sensor_fault' | 'uptime'; label: string; severity: 'attention' | 'critical' }

/** Derives hardware health for a device from its static fields. */
export function deviceHealth(d: Device): { status: HealthStatus; issues: HealthIssue[] } {
  const issues: HealthIssue[] = [];
  const type = deviceTypeById.get(d.deviceTypeId);
  if (d.status === 'offline') issues.push({ code: 'offline', label: 'Offline – no push status', severity: 'critical' });
  if (d.sensorFaults > 0) issues.push({ code: 'sensor_fault', label: `${d.sensorFaults} sensor fault${d.sensorFaults > 1 ? 's' : ''}`, severity: 'critical' });
  const next = Date.parse(d.nextMaintenanceAt);
  if (next < FIXTURE_NOW_MS) issues.push({ code: 'maintenance_overdue', label: `Preventive check overdue ${Math.ceil((FIXTURE_NOW_MS - next) / DAY)}d`, severity: 'attention' });
  else if (next < FIXTURE_NOW_MS + 30 * DAY) issues.push({ code: 'maintenance_due', label: `Preventive check due in ${Math.ceil((next - FIXTURE_NOW_MS) / DAY)}d`, severity: 'attention' });
  if (type && d.firmware !== type.latestFirmware) issues.push({ code: 'firmware', label: `Firmware ${d.firmware} (latest ${type.latestFirmware})`, severity: 'attention' });
  const warranty = Date.parse(d.warrantyUntil);
  if (warranty < FIXTURE_NOW_MS) issues.push({ code: 'warranty', label: 'Warranty expired', severity: 'attention' });
  else if (warranty < FIXTURE_NOW_MS + 90 * DAY) issues.push({ code: 'warranty', label: `Warranty ends in ${Math.ceil((warranty - FIXTURE_NOW_MS) / DAY)}d`, severity: 'attention' });
  if (d.uptimePct < 95) issues.push({ code: 'uptime', label: `Uptime ${d.uptimePct.toFixed(1)}% (30d)`, severity: 'attention' });
  const status: HealthStatus = issues.some((i) => i.severity === 'critical') ? 'critical' : issues.length ? 'attention' : 'healthy';
  return { status, issues };
}

export const isTicketOpen = (t: MaintenanceTicket) => t.status !== 'DONE';
export const isTicketOverdue = (t: MaintenanceTicket) => isTicketOpen(t) && !!t.scheduledAt && Date.parse(t.scheduledAt) < FIXTURE_NOW_MS;

export function ticketCounts(list: MaintenanceTicket[]) {
  const c = { OPEN: 0, SCHEDULED: 0, IN_PROGRESS: 0, DONE: 0, overdue: 0 };
  for (const t of list) { c[t.status]++; if (isTicketOverdue(t)) c.overdue++; }
  return c;
}

export function nextTicketId(existing: MaintenanceTicket[]): string {
  const max = existing.reduce((m, t) => Math.max(m, Number(t.id.replace('MT-', '')) || 0), 0);
  return `MT-${max + 1}`;
}
