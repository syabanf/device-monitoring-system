import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { Db } from '../src/db/client';
import type { Env } from '../src/env';
import { createQueue } from '../src/jobs/queue';

const env: Env = {
  NODE_ENV: 'test', PORT: 0, LOG_LEVEL: 'fatal',
  DATABASE_URL: 'postgresql://localhost/test', JWT_SECRET: 'x'.repeat(40), WEBHOOK_SECRET: 'webhook-secret',
  CORS_ORIGINS: 'http://localhost:5173', ACCESS_TOKEN_TTL_SEC: 900, DEVICE_TOKEN_TTL_SEC: 1000,
};

/** Only the calls these routes make; the repo layer is covered by its own integration tests. */
const db = {
  $queryRaw: async () => [{ '?column?': 1 }],
  adminUser: { findUnique: async () => null },
  employee: { findUnique: async () => null },
  technician: { findUnique: async () => null },
} as unknown as Db;

const app = async () => buildApp({ env, db, queue: createQueue(env) });

describe('api wiring', () => {
  it('reports health with the queue mode', async () => {
    const res = await (await app()).inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, db: 'up', queue: 'inline' });
  });

  it('rejects an unauthenticated tenant read', async () => {
    const res = await (await app()).inject({ method: 'GET', url: '/distributors/dst-sby/outlets' });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHORIZED');
  });

  it('answers a wrong password with problem+json, never a stack trace', async () => {
    const res = await (await app()).inject({ method: 'POST', url: '/auth/admin/login', payload: { email: 'nobody@wit.id', password: 'wrong-password' } });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  it('refuses a token whose distributor differs from the url', async () => {
    const instance = await app();
    const token = instance.jwt.sign({ sub: 'adm-001', kind: 'admin', distributorId: 'dst-sby' });
    const res = await instance.inject({ method: 'GET', url: '/distributors/dst-jkt/outlets', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('validates the request body against the contract', async () => {
    const res = await (await app()).inject({ method: 'POST', url: '/auth/admin/login', payload: { email: 'not-an-email', password: '123' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_FAILED');
  });
});
