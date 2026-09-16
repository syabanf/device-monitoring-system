import { Prisma } from '@prisma/client';
import type { Db } from '../db/client';
import { newId } from '../lib/ids';
import type { EventName, Queue } from './queue';

/**
 * Outbox row first, queue signal second. A crash in between replays the notification instead
 * of dropping it, and no request ever calls push or Telegram directly.
 */
export async function emit(db: Db, queue: Queue, name: EventName, payload: Record<string, unknown>): Promise<void> {
  await db.outboxEvent.create({ data: { id: newId('evt'), name, payload: payload as Prisma.InputJsonValue } });
  await queue.enqueue(name, payload);
}
