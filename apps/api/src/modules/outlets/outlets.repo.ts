import type { Outlet } from '@monitoring/types';
import type { OutletInput } from '@monitoring/contracts';
import type { Db } from '../../db/client';
import { toOutlet } from '../../db/map';
import { decodeCursor, toPage } from '../../lib/pagination';

/** Every query filters by tenant. This is the server-side twin of useScoped(). */
export const outletsRepo = (db: Db, tenant: string) => ({
  async list(opts: { cursor?: string; limit: number; q?: string }) {
    const after = decodeCursor(opts.cursor);
    const rows = await db.outlet.findMany({
      where: {
        distributorId: tenant,
        ...(after ? { code: { gt: after } } : {}),
        ...(opts.q ? { OR: [{ name: { contains: opts.q, mode: 'insensitive' } }, { code: { contains: opts.q, mode: 'insensitive' } }, { address: { contains: opts.q, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { code: 'asc' },
      take: opts.limit + 1,
    });
    const paged = toPage(rows, opts.limit, (r) => r.code);
    return { items: paged.items.map(toOutlet), nextCursor: paged.nextCursor };
  },

  async find(outletId: string): Promise<Outlet | null> {
    const row = await db.outlet.findFirst({ where: { id: outletId, distributorId: tenant } });
    return row ? toOutlet(row) : null;
  },

  async create(id: string, input: OutletInput): Promise<Outlet> {
    return toOutlet(await db.outlet.create({ data: { id, distributorId: tenant, ...input } }));
  },

  async update(outletId: string, input: OutletInput): Promise<Outlet> {
    return toOutlet(await db.outlet.update({ where: { id: outletId }, data: input }));
  },

  /** Devices, sensors, alerts, tickets and contacts cascade through the schema. */
  async remove(outletId: string): Promise<void> {
    await db.outlet.delete({ where: { id: outletId } });
  },
});
