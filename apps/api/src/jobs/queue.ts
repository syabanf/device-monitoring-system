import type { Env } from '../env';

export type EventName = 'alert.triggered' | 'alert.cleared' | 'alert.responded' | 'ticket.completed';
export type EventHandler = (name: EventName, payload: Record<string, unknown>) => Promise<void>;

export interface Queue {
  readonly mode: 'redis' | 'inline';
  enqueue(name: EventName, payload: Record<string, unknown>): Promise<void>;
  /** main.ts wires the dispatcher after the db and notifiers exist. */
  setHandler(handler: EventHandler): void;
  close(): Promise<void>;
}

/**
 * Redis is optional on purpose: local development runs handlers inline so one process is
 * enough, while production gets BullMQ retries and a dead letter queue.
 */
export function createQueue(env: Env): Queue {
  let handler: EventHandler = async () => {};
  const setHandler = (h: EventHandler) => { handler = h; };

  if (!env.REDIS_URL) {
    return { mode: 'inline', enqueue: (name, payload) => handler(name, payload), setHandler, close: async () => {} };
  }

  const connection = { url: env.REDIS_URL };
  // Imported lazily so the inline path never loads ioredis.
  const started = import('bullmq').then(({ Queue: BullQueue, Worker }) => ({
    queue: new BullQueue('events', { connection, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 500, removeOnFail: 5000 } }),
    worker: new Worker('events', async (job) => handler(job.name as EventName, job.data as Record<string, unknown>), { connection }),
  }));

  return {
    mode: 'redis',
    enqueue: async (name, payload) => { const { queue } = await started; await queue.add(name, payload); },
    setHandler,
    close: async () => { const { queue, worker } = await started; await worker.close(); await queue.close(); },
  };
}
