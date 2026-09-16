import type { Alert, AlertCategory } from '@monitoring/types';
import { format } from 'date-fns';
import { nowMs } from './constants';
import { toWallClockDate } from './format';

export const isOpen = (a: Alert) => a.status === 'UNACKNOWLEDGED' || a.status === 'ACKNOWLEDGED' || a.status === 'RESPONDING';
export const isSolved = (a: Alert) => a.status === 'RESOLVED' || a.status === 'VERIFIED';
export const alertTab = (a: Alert) => a.status.toLowerCase();

export type Period = 'today' | '7d' | '30d' | 'all';
export function periodStartMs(p: Period): number {
  if (p === 'all') return 0;
  if (p === 'today') {
    const w = toWallClockDate(nowMs());
    w.setHours(0, 0, 0, 0);
    // convert back: wall-clock midnight -> real ms
    const wallMidnightUtc = Date.UTC(w.getFullYear(), w.getMonth(), w.getDate());
    return wallMidnightUtc - 7 * 3_600_000;
  }
  const days = p === '7d' ? 7 : 30;
  return nowMs() - days * 86_400_000;
}
export function inPeriod(a: Alert, p: Period): boolean {
  return Date.parse(a.triggerTime) >= periodStartMs(p);
}

export function openVsSolved(list: Alert[]) {
  let open = 0, solved = 0;
  for (const a of list) (isSolved(a) ? solved++ : open++);
  return { open, solved, total: open + solved };
}

export interface DayBucket { day: string; label: string; COMFORT: number; SECURITY: number; total: number }
export function alertsPerDay(list: Alert[], days = 14): DayBucket[] {
  const buckets: DayBucket[] = [];
  const map = new Map<string, DayBucket>();
  for (let i = days - 1; i >= 0; i--) {
    const d = toWallClockDate(nowMs() - i * 86_400_000);
    const key = format(d, 'yyyy-MM-dd');
    const b: DayBucket = { day: key, label: format(d, 'dd MMM'), COMFORT: 0, SECURITY: 0, total: 0 };
    buckets.push(b);
    map.set(key, b);
  }
  for (const a of list) {
    const key = format(toWallClockDate(a.triggerTime), 'yyyy-MM-dd');
    const b = map.get(key);
    if (b) { b[a.category as AlertCategory]++; b.total++; }
  }
  return buckets;
}

export function avgResponseSec(list: Alert[]): number | null {
  const withResp = list.filter((a) => a.response);
  if (!withResp.length) return null;
  return withResp.reduce((s, a) => s + a.response!.responseDurationSec, 0) / withResp.length;
}

export interface OutletResponseStat { outletId: string; avgSec: number; count: number }
export function avgResponseByOutlet(list: Alert[]): OutletResponseStat[] {
  const m = new Map<string, { sum: number; n: number }>();
  for (const a of list) {
    if (!a.response) continue;
    const cur = m.get(a.outletId) ?? { sum: 0, n: 0 };
    cur.sum += a.response.responseDurationSec;
    cur.n++;
    m.set(a.outletId, cur);
  }
  return [...m.entries()].map(([outletId, { sum, n }]) => ({ outletId, avgSec: sum / n, count: n }));
}

export function responseRate(list: Alert[]): number | null {
  if (!list.length) return null;
  return list.filter((a) => a.response).length / list.length;
}
