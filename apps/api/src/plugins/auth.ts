import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sessionClaims, type SessionClaims } from '@monitoring/contracts';
import type { Env } from '../env';
import { forbidden, unauthorized } from '../lib/errors';

/** What every service receives. Services never see req or res. */
export interface Ctx {
  tenant: string;
  userId: string;
  kind: SessionClaims['kind'];
  outletIds: string[] | null;
  now: Date;
}

declare module 'fastify' {
  interface FastifyRequest {
    ctx?: Ctx;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>;
  }
}

export async function registerAuth(app: FastifyInstance, env: Env): Promise<void> {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw unauthorized('Missing or invalid bearer token');
    }
    const claims = sessionClaims.safeParse(req.user);
    if (!claims.success) throw unauthorized('Token payload is not a session');
    req.ctx = {
      tenant: claims.data.distributorId,
      userId: claims.data.sub,
      kind: claims.data.kind,
      outletIds: claims.data.outletIds ?? null,
      now: new Date(),
    };
  });
}

/** Reads the context an authenticated route is guaranteed to have. */
export function ctxOf(req: FastifyRequest): Ctx {
  if (!req.ctx) throw unauthorized('Route is missing the authenticate preHandler');
  return req.ctx;
}

/** The URL tenant must match the token tenant. The token always wins. */
export function assertTenant(req: FastifyRequest, distributorId: string): Ctx {
  const ctx = ctxOf(req);
  if (ctx.tenant !== distributorId) throw forbidden('Token belongs to a different distribution center');
  return ctx;
}

export function assertAdmin(req: FastifyRequest): Ctx {
  const ctx = ctxOf(req);
  if (ctx.kind !== 'admin') throw forbidden('Admin only');
  return ctx;
}
