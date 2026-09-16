import type { FastifyBaseLogger } from 'fastify';

export interface NotifyTarget {
  employeeId: string;
  channels: ('app' | 'telegram')[];
}

/** One interface for push, Telegram and email so services stay channel-agnostic. */
export interface Notifier {
  readonly name: string;
  send(event: string, payload: Record<string, unknown>, targets: NotifyTarget[]): Promise<void>;
}

/** Development default. Swap for FcmNotifier and TelegramNotifier once credentials exist. */
export function noopNotifier(log: FastifyBaseLogger): Notifier {
  return {
    name: 'noop',
    async send(event, payload, targets) {
      log.info({ event, targets: targets.length, payload }, 'notify (noop)');
    },
  };
}
