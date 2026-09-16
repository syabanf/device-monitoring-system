import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/client';
import type { Notifier } from '../notify/notifier';
import type { EventHandler } from './queue';

const MAX_ATTEMPTS = 5;

/**
 * Drains the outbox. Services write rows inside their transaction, so a crash between the
 * write and the fan-out replays instead of losing the notification.
 */
export function outboxDispatcher(db: Db, notifier: Notifier, log: FastifyBaseLogger): EventHandler {
  return async () => {
    const pending = await db.outboxEvent.findMany({
      where: { processedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { at: 'asc' },
      take: 50,
    });
    for (const row of pending) {
      try {
        const payload = row.payload as Record<string, unknown>;
        const targets = await targetsFor(db, payload);
        await notifier.send(row.name, payload, targets);
        await db.outboxEvent.update({ where: { id: row.id }, data: { processedAt: new Date() } });
      } catch (err) {
        log.error({ err, event: row.name, id: row.id }, 'outbox delivery failed');
        await db.outboxEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      }
    }
  };
}

/** Everyone registered at the outlet hears about it; the first responder closes the loop. */
async function targetsFor(db: Db, payload: Record<string, unknown>) {
  const outletId = typeof payload.outletId === 'string' ? payload.outletId : null;
  if (!outletId) return [];
  const employees = await db.employee.findMany({
    where: { registrationStatus: 'approved', outlets: { some: { id: outletId } } },
    select: { id: true },
  });
  return employees.map((e) => ({ employeeId: e.id, channels: ['app' as const, 'telegram' as const] }));
}
