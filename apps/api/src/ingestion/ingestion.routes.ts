import { createHmac, timingSafeEqual } from 'node:crypto';
import { emailWebhookBody, ingestResponse, problemSchema, roomAlertWebhookBody } from '@monitoring/contracts';
import { parseEmail, parseWebhook } from '@monitoring/integration';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/errors';
import { newId } from '../lib/ids';
import { ingest } from './alert-engine';

/** Room Alert signs the exact bytes it posted, so the raw body has to survive parsing. */
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export const ingestionRoutes: FastifyPluginAsyncZod = async (app) => {
  const { env, db, queue } = app.deps;

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = body as string;
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  const verify = (req: FastifyRequest) => {
    const signature = req.headers['x-signature'];
    if (typeof signature !== 'string') {
      if (env.NODE_ENV === 'production') throw unauthorized('Missing X-Signature header');
      req.log.warn('webhook accepted without a signature (development only)');
      return;
    }
    const expected = createHmac('sha256', env.WEBHOOK_SECRET).update(req.rawBody ?? '').digest();
    const given = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw unauthorized('Signature does not match the payload');
  };

  const log = async (path: string, status: number, ms: number, summary: string) => {
    await db.requestLog.create({ data: { id: newId('log'), direction: 'inbound', channel: path.includes('email') ? 'email' : 'roomalert', method: 'POST', path, status, ms, summary } });
  };

  app.post('/webhooks/roomalert', {
    schema: { tags: ['ingestion'], body: roomAlertWebhookBody, response: { 202: ingestResponse, 401: problemSchema, 422: ingestResponse } },
  }, async (req, reply) => {
    verify(req);
    const started = Date.now();
    const result = await ingest(db, queue, parseWebhook(req.rawBody ?? JSON.stringify(req.body)));
    const status = result.accepted ? 202 : 422;
    await log('/webhooks/roomalert', status, Date.now() - started, result.reason ?? `${result.alertId}`);
    return reply.status(status).send(result);
  });

  app.post('/webhooks/email', {
    schema: { tags: ['ingestion'], body: emailWebhookBody, response: { 202: ingestResponse, 401: problemSchema, 422: ingestResponse } },
  }, async (req, reply) => {
    verify(req);
    const started = Date.now();
    const result = await ingest(db, queue, parseEmail(req.body.raw));
    const status = result.accepted ? 202 : 422;
    await log('/webhooks/email', status, Date.now() - started, result.reason ?? `${result.alertId}`);
    return reply.status(status).send(result);
  });
};
