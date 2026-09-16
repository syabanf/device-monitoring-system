import { healthResponse } from '@monitoring/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

const startedAt = Date.now();

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/health', { schema: { tags: ['system'], response: { 200: healthResponse } } }, async () => {
    const { db, queue } = app.deps;
    let dbUp = true;
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      dbUp = false;
    }
    return {
      ok: dbUp,
      version: '0.1.0',
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      db: dbUp ? ('up' as const) : ('down' as const),
      queue: queue.mode === 'inline' ? ('inline' as const) : ('up' as const),
    };
  });
};
