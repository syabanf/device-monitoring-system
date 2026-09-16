import type { AlertEvent } from '@monitoring/integration';
import { categoryFor } from '@monitoring/integration';
import type { Db } from '../db/client';
import { emit } from '../jobs/emit';
import { newId } from '../lib/ids';
import type { Queue } from '../jobs/queue';
import { resolveEvent } from './normalise';

export interface IngestResult {
  accepted: boolean;
  alertId: number | null;
  reason?: string;
}

/** Wording the outlet staff sees on their phone. */
function messageFor(type: AlertEvent['sensorType'], value: string): string {
  switch (type) {
    case 'TEMPERATURE':
    case 'TEMPERATURE_HUMIDITY':
      return value.includes('%') ? 'Humidity above 60.0 %RH' : 'Temperature above 28.00 °C';
    case 'DOOR':
      return 'Door opened outside operational hours';
    case 'MOTION':
      return 'Motion detected outside operational hours';
    case 'POWER':
      return 'Main power lost';
    default:
      return 'Panic button pressed';
  }
}

/**
 * Opens a new alert, or closes the matching open one when the cloud reports a clear.
 * Replays of the same external id return the alert that already exists.
 */
export async function ingest(db: Db, queue: Queue, event: AlertEvent): Promise<IngestResult> {
  const resolved = await resolveEvent(db, event);
  if ('reason' in resolved) {
    await db.unmatchedEvent.create({ data: { id: newId('unm'), source: event.source, reason: resolved.reason, raw: event.raw } });
    return { accepted: false, alertId: null, reason: resolved.reason };
  }

  const at = new Date(event.at);
  if (event.externalAlertId) {
    const seen = await db.alert.findUnique({ where: { externalAlertId: event.externalAlertId }, select: { id: true } });
    if (seen && event.event === 'TRIGGERED') return { accepted: true, alertId: seen.id };
  }

  if (event.event === 'CLEARED') {
    const open = await db.alert.findFirst({
      where: { sensorId: resolved.sensorId, status: { notIn: ['RESOLVED', 'VERIFIED'] } },
      orderBy: { triggerTime: 'desc' },
      select: { id: true, outletId: true },
    });
    if (!open) return { accepted: false, alertId: null, reason: 'No open alert on this sensor to clear' };
    await db.alert.update({ where: { id: open.id }, data: { status: 'RESOLVED', clearValue: event.value || null, clearTime: at, resolvedAt: at } });
    await emit(db, queue, 'alert.cleared', { alertId: open.id, outletId: open.outletId });
    return { accepted: true, alertId: open.id };
  }

  const created = await db.alert.create({
    data: {
      externalAlertId: event.externalAlertId,
      distributorId: resolved.distributorId,
      outletId: resolved.outletId,
      deviceId: resolved.deviceId,
      sensorId: resolved.sensorId,
      sensorName: resolved.sensorName,
      sensorType: resolved.sensorType,
      category: categoryFor(resolved.sensorType, event.at),
      status: 'UNACKNOWLEDGED',
      triggerValue: event.value || '-',
      triggerTime: at,
      message: messageFor(resolved.sensorType, event.value),
      channels: ['app'],
    },
    select: { id: true },
  });
  await emit(db, queue, 'alert.triggered', { alertId: created.id, outletId: resolved.outletId });
  return { accepted: true, alertId: created.id };
}
