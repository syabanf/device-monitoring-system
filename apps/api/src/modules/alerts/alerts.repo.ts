import type { Alert, AlertStatus } from '@monitoring/types';
import type { Db } from '../../db/client';
import { toAlert } from '../../db/map';
import { decodeCursor, encodeCursor } from '../../lib/pagination';

const include = { response: true } as const;
/** Newest first, so the cursor carries both sort keys to stay stable across equal timestamps. */
const cursorOf = (a: { triggerTime: Date; id: number }) => encodeCursor(`${a.triggerTime.toISOString()}|${a.id}`);

export const alertsRepo = (db: Db, tenant: string) => ({
  async list(opts: { cursor?: string; limit: number; outletId?: string; status?: AlertStatus; category?: 'COMFORT' | 'SECURITY'; since?: string }) {
    const [afterTime, afterId] = (decodeCursor(opts.cursor) ?? '').split('|');
    const rows = await db.alert.findMany({
      where: {
        distributorId: tenant,
        ...(opts.outletId ? { outletId: opts.outletId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.since ? { triggerTime: { gte: new Date(opts.since) } } : {}),
        ...(afterTime
          ? { OR: [{ triggerTime: { lt: new Date(afterTime) } }, { triggerTime: new Date(afterTime), id: { lt: Number(afterId) } }] }
          : {}),
      },
      orderBy: [{ triggerTime: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      include,
    });
    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    return { items: items.map(toAlert), nextCursor: hasMore ? cursorOf(items[items.length - 1]!) : null };
  },

  async find(alertId: number): Promise<Alert | null> {
    const row = await db.alert.findFirst({ where: { id: alertId, distributorId: tenant }, include });
    return row ? toAlert(row) : null;
  },

  /**
   * First responder wins: the update only matches while no response exists, so a second
   * employee tapping at the same moment gets zero rows instead of overwriting the first.
   */
  async claim(alertId: number, employeeId: string, at: Date): Promise<boolean> {
    const claimed = await db.alert.updateMany({
      where: { id: alertId, distributorId: tenant, assigneeEmployeeId: null },
      data: { assigneeEmployeeId: employeeId, respondingAt: at, status: 'RESPONDING' },
    });
    return claimed.count === 1;
  },

  async saveResponse(alertId: number, employeeId: string, notes: string, photoUrls: string[], at: Date, durationSec: number): Promise<Alert> {
    await db.alertResponse.create({ data: { alertId, employeeId, notes, photoUrls, respondedAt: at, responseDurationSec: durationSec } });
    return toAlert(await db.alert.findUniqueOrThrow({ where: { id: alertId }, include }));
  },

  async setStatus(alertId: number, status: AlertStatus, at: Date, clearValue?: string): Promise<Alert> {
    const stamp: Record<AlertStatus, Record<string, unknown>> = {
      UNACKNOWLEDGED: {},
      ACKNOWLEDGED: { acknowledgedAt: at },
      RESPONDING: { respondingAt: at },
      RESOLVED: { resolvedAt: at, clearTime: at, clearValue: clearValue ?? null },
      VERIFIED: { verifiedAt: at },
    };
    return toAlert(await db.alert.update({ where: { id: alertId }, data: { status, ...stamp[status] }, include }));
  },
});
