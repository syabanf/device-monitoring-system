import { format, isSameDay, isYesterday } from 'date-fns';
import { nowMs, TZ_LABEL } from './constants';

const TZ_OFFSET_MS = 7 * 3_600_000;

/** Returns a Date whose *UTC* fields equal the +07:00 wall-clock fields of the ISO string. */
function wall(isoOrMs: string | number): Date {
  const ms = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  return new Date(ms + TZ_OFFSET_MS);
}
// date-fns formats in the host local time; we shift so that "local" fields are the +07:00 wall clock.
function shifted(isoOrMs: string | number): Date {
  const w = wall(isoOrMs);
  return new Date(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), w.getUTCHours(), w.getUTCMinutes(), w.getUTCSeconds());
}

export function fmtTime(iso: string): string {
  return format(shifted(iso), 'HH:mm');
}
export function fmtDate(iso: string): string {
  return format(shifted(iso), 'dd/MM/yyyy');
}
export function fmtDateTime(iso: string): string {
  return `${format(shifted(iso), 'MMM dd yyyy HH:mm')} ${TZ_LABEL}`;
}
export function fmtDateTimeLong(iso: string): string {
  return `${format(shifted(iso), 'MMM dd yyyy hh:mm a')} ${TZ_LABEL}`;
}
/** "Today, 13:24" / "Yesterday, 08:10" / "02 Sep, 21:45" */
export function fmtRelativeDay(iso: string): string {
  const d = shifted(iso);
  const today = shifted(nowMs());
  if (isSameDay(d, today)) return `Today, ${format(d, 'HH:mm')}`;
  if (isYesterday(d) || isSameDay(d, new Date(today.getTime() - 86_400_000))) return `Yesterday, ${format(d, 'HH:mm')}`;
  return format(d, 'dd MMM, HH:mm');
}
/** "5 min ago", "3 hours ago", "2 days ago" relative to the current time. */
export function fmtAgo(iso: string): string {
  const diff = Math.max(0, nowMs() - Date.parse(iso));
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}
/** "2 hours, 1 minute" */
export function humanizeDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  if (h) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
  if (m) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
  if (!parts.length || (!d && !h)) parts.push(`${sec} second${sec !== 1 ? 's' : ''}`);
  return parts.slice(0, 2).join(', ');
}
/** Short: "16m", "2h 5m", "1d 3h" */
export function humanizeShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}
export function ongoingSeconds(triggerIso: string, endIso?: string | null): number {
  const end = endIso ? Date.parse(endIso) : nowMs();
  return Math.max(0, (end - Date.parse(triggerIso)) / 1000);
}
export const cToF = (c: number) => c * 1.8 + 32;
/** "26.50 C / 79.70 F" */
export function fmtTempCF(c: number): string {
  return `${c.toFixed(2)} C / ${cToF(c).toFixed(2)} F`;
}
export function fmtReading(temperatureC: number, humidityPct: number): string {
  return `${temperatureC.toFixed(1)} °C · ${humidityPct.toFixed(0)} %RH`;
}
export function fmtIdr(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
/** How a unit's model reads in the UI, for example "AKCP SP1+". */
export function unitName(model: string): string {
  return `AKCP ${model}`;
}

export function maskToken(token: string | null): string {
  if (!token) return '—';
  return `${token.slice(0, 2)}••••••${token.slice(-2)}`;
}
export { shifted as toWallClockDate };
