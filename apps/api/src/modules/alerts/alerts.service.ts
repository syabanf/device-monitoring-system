import type { Alert, AlertStatus } from '@monitoring/types';
import type { Db } from '../../db/client';
import { conflict, forbidden, notFound } from '../../lib/errors';
import type { Ctx } from '../../plugins/auth';
import { emit } from '../../jobs/emit';
import type { Queue } from '../../jobs/queue';
import { alertsRepo } from './alerts.repo';

/** The lifecycle the dashboard tabs show. Admins may close an alert from any state. */
const NEXT: Record<AlertStatus, AlertStatus[]> = {
  UNACKNOWLEDGED: ['ACKNOWLEDGED', 'RESPONDING', 'RESOLVED'],
  ACKNOWLEDGED: ['RESPONDING', 'RESOLVED'],
  RESPONDING: ['RESOLVED'],
  RESOLVED: ['VERIFIED'],
  VERIFIED: [],
};

export const alertsService = (db: Db, ctx: Ctx, queue: Queue) => {
  const repo = alertsRepo(db, ctx.tenant);

  const visible = (alert: Alert) => ctx.kind !== 'employee' || (ctx.outletIds ?? []).includes(alert.outletId);

  const load = async (alertId: number): Promise<Alert> => {
    const alert = await repo.find(alertId);
    if (!alert) throw notFound('Alert', alertId);
    if (!visible(alert)) throw forbidden('Alert belongs to another outlet');
    return alert;
  };

  return {
    async list(opts: Parameters<typeof repo.list>[0]) {
      // Employees only ever see their own outlets, whatever the query says.
      if (ctx.kind === 'employee') {
        const mine = ctx.outletIds ?? [];
        if (opts.outletId && !mine.includes(opts.outletId)) throw forbidden('Outlet is outside your registration');
        if (!opts.outletId && mine.length === 1) return repo.list({ ...opts, outletId: mine[0] });
      }
      return repo.list(opts);
    },

    get: load,

    async respond(alertId: number, notes: string, photoUrls: string[]): Promise<Alert> {
      if (ctx.kind !== 'employee') throw forbidden('Only outlet employees respond to alerts');
      const alert = await load(alertId);
      if (alert.response) throw conflict('ALREADY_RESPONDED', 'Another employee already responded to this alert');
      if (!(await repo.claim(alertId, ctx.userId, ctx.now))) {
        throw conflict('ALREADY_RESPONDED', 'Another employee claimed this alert first');
      }
      const durationSec = Math.max(0, Math.round((ctx.now.getTime() - Date.parse(alert.triggerTime)) / 1000));
      const saved = await repo.saveResponse(alertId, ctx.userId, notes, photoUrls, ctx.now, durationSec);
      await emit(db, queue, 'alert.responded', { alertId, outletId: alert.outletId, employeeId: ctx.userId });
      return saved;
    },

    async setStatus(alertId: number, status: AlertStatus, clearValue?: string): Promise<Alert> {
      const alert = await load(alertId);
      if (alert.status === status) return alert;
      if (!NEXT[alert.status].includes(status)) {
        throw conflict('INVALID_TRANSITION', `Cannot move an alert from ${alert.status} to ${status}`);
      }
      if (status === 'VERIFIED' && ctx.kind !== 'admin') throw forbidden('Only an admin verifies a resolved alert');
      const updated = await repo.setStatus(alertId, status, ctx.now, clearValue);
      if (status === 'RESOLVED') await emit(db, queue, 'alert.cleared', { alertId, outletId: alert.outletId });
      return updated;
    },
  };
};
