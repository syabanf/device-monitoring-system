import type { MaintenanceTicket, TicketStatus } from '@monitoring/types';
import type { TicketInput, TicketPatch } from '@monitoring/contracts';
import type { Db } from '../../db/client';
import { toTicket } from '../../db/map';
import { decodeCursor, toPage } from '../../lib/pagination';

export const ticketsRepo = (db: Db, tenant: string) => ({
  async list(opts: { cursor?: string; limit: number; outletId?: string; status?: TicketStatus; technicianId?: string }) {
    const after = decodeCursor(opts.cursor);
    const rows = await db.maintenanceTicket.findMany({
      where: {
        distributorId: tenant,
        ...(opts.outletId ? { outletId: opts.outletId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.technicianId ? { technicianId: opts.technicianId } : {}),
        ...(after ? { id: { lt: after } } : {}),
      },
      orderBy: { id: 'desc' },
      take: opts.limit + 1,
    });
    const paged = toPage(rows, opts.limit, (r) => r.id);
    return { items: paged.items.map(toTicket), nextCursor: paged.nextCursor };
  },

  async find(ticketId: string): Promise<MaintenanceTicket | null> {
    const row = await db.maintenanceTicket.findFirst({ where: { id: ticketId, distributorId: tenant } });
    return row ? toTicket(row) : null;
  },

  /** Tickets keep the MT-#### series operators read out on the phone. */
  async nextId(): Promise<string> {
    const last = await db.maintenanceTicket.findFirst({ where: { distributorId: tenant }, orderBy: { id: 'desc' }, select: { id: true } });
    const n = last ? Number(last.id.replace('MT-', '')) : 2600;
    return `MT-${(Number.isFinite(n) ? n : 2600) + 1}`;
  },

  async create(id: string, input: TicketInput, createdAt: Date): Promise<MaintenanceTicket> {
    return toTicket(await db.maintenanceTicket.create({
      data: {
        id, distributorId: tenant, outletId: input.outletId, deviceId: input.deviceId, sensorId: input.sensorId,
        type: input.type, priority: input.priority, status: input.technicianId ? 'SCHEDULED' : 'OPEN',
        title: input.title, description: input.description, technicianId: input.technicianId,
        createdAt, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        partsUsed: [], photoUrls: [],
      },
    }));
  },

  async patch(ticketId: string, patch: TicketPatch, completedAt: Date | null): Promise<MaintenanceTicket> {
    return toTicket(await db.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.priority ? { priority: patch.priority } : {}),
        ...(patch.technicianId !== undefined ? { technicianId: patch.technicianId } : {}),
        ...(patch.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt ? new Date(patch.scheduledAt) : null } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.partsUsed ? { partsUsed: patch.partsUsed } : {}),
        ...(patch.photoUrls ? { photoUrls: patch.photoUrls } : {}),
        completedAt,
      },
    }));
  },
});
