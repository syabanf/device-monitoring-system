import type { OutletInput } from '@monitoring/contracts';
import type { Outlet } from '@monitoring/types';
import type { Ctx } from '../../plugins/auth';
import type { Db } from '../../db/client';
import { conflict, notFound } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { outletsRepo } from './outlets.repo';

export const outletsService = (db: Db, ctx: Ctx) => {
  const repo = outletsRepo(db, ctx.tenant);
  return {
    list: repo.list,

    async get(outletId: string): Promise<Outlet> {
      const outlet = await repo.find(outletId);
      if (!outlet) throw notFound('Outlet', outletId);
      return outlet;
    },

    async create(input: OutletInput): Promise<Outlet> {
      await assertCodeFree(db, ctx.tenant, input.code);
      return repo.create(newId('out'), withMapsUrl(input));
    },

    async update(outletId: string, input: OutletInput): Promise<Outlet> {
      const existing = await repo.find(outletId);
      if (!existing) throw notFound('Outlet', outletId);
      if (existing.code !== input.code) await assertCodeFree(db, ctx.tenant, input.code);
      return repo.update(outletId, withMapsUrl(input));
    },

    async remove(outletId: string): Promise<void> {
      const existing = await repo.find(outletId);
      if (!existing) throw notFound('Outlet', outletId);
      await repo.remove(outletId);
    },
  };
};

/** Operators paste coordinates far more often than a Maps link, so derive it when empty. */
const withMapsUrl = (input: OutletInput): OutletInput =>
  input.mapsUrl.trim() ? input : { ...input, mapsUrl: `https://maps.google.com/?q=${input.lat},${input.lng}` };

async function assertCodeFree(db: Db, tenant: string, code: string): Promise<void> {
  const clash = await db.outlet.findFirst({ where: { distributorId: tenant, code }, select: { id: true } });
  if (clash) throw conflict('OUTLET_CODE_TAKEN', `Outlet code ${code} already exists in this distribution center`);
}
