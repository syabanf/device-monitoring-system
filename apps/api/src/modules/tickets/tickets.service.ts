import type { TicketInput, TicketPatch } from '@monitoring/contracts';
import type { MaintenanceTicket, TicketStatus } from '@monitoring/types';
import type { Db } from '../../db/client';
import { conflict, forbidden, notFound } from '../../lib/errors';
import { emit } from '../../jobs/emit';
import type { Queue } from '../../jobs/queue';
import type { Ctx } from '../../plugins/auth';
import { ticketsRepo } from './tickets.repo';

const NEXT: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['SCHEDULED', 'IN_PROGRESS', 'DONE'],
  SCHEDULED: ['IN_PROGRESS', 'OPEN', 'DONE'],
  IN_PROGRESS: ['DONE', 'SCHEDULED'],
  DONE: [],
};

export const ticketsService = (db: Db, ctx: Ctx, queue: Queue) => {
  const repo = ticketsRepo(db, ctx.tenant);

  const load = async (ticketId: string): Promise<MaintenanceTicket> => {
    const ticket = await repo.find(ticketId);
    if (!ticket) throw notFound('Ticket', ticketId);
    return ticket;
  };

  return {
    list: repo.list,
    get: load,

    async create(input: TicketInput): Promise<MaintenanceTicket> {
      const device = await db.device.findFirst({ where: { id: input.deviceId, distributorId: ctx.tenant, outletId: input.outletId }, select: { id: true } });
      if (!device) throw notFound('Device', input.deviceId);
      return repo.create(await repo.nextId(), input, ctx.now);
    },

    async patch(ticketId: string, patch: TicketPatch): Promise<MaintenanceTicket> {
      const ticket = await load(ticketId);
      if (ctx.kind === 'employee') throw forbidden('Employees report issues but do not work tickets');
      if (ctx.kind === 'technician' && ticket.technicianId && ticket.technicianId !== ctx.userId) {
        throw forbidden('Ticket is assigned to another technician');
      }
      if (patch.status && patch.status !== ticket.status && !NEXT[ticket.status].includes(patch.status)) {
        throw conflict('INVALID_TRANSITION', `Cannot move a ticket from ${ticket.status} to ${patch.status}`);
      }
      const completing = patch.status === 'DONE' && ticket.status !== 'DONE';
      const updated = await repo.patch(ticketId, patch, completing ? ctx.now : ticket.completedAt ? new Date(ticket.completedAt) : null);
      if (completing) await emit(db, queue, 'ticket.completed', { ticketId, outletId: ticket.outletId, deviceId: ticket.deviceId });
      return updated;
    },
  };
};
