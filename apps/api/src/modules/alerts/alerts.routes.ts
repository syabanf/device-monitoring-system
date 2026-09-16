import { alertSchema, alertStatusBody, alertsQuery, distributorParam, page, problemSchema, respondBody } from '@monitoring/contracts';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { assertTenant, ctxOf } from '../../plugins/auth';
import { alertsService } from './alerts.service';

const alertParam = z.object({ alertId: z.coerce.number().int().positive() });
const errors = { 401: problemSchema, 403: problemSchema, 404: problemSchema, 409: problemSchema };

export const alertRoutes: FastifyPluginAsyncZod = async (app) => {
  const forRequest = (req: FastifyRequest, distributorId?: string) =>
    alertsService(app.deps.db, distributorId ? assertTenant(req, distributorId) : ctxOf(req), app.deps.queue);

  app.get('/distributors/:distributorId/alerts', {
    onRequest: app.authenticate,
    schema: { tags: ['alerts'], params: distributorParam, querystring: alertsQuery, response: { 200: page(alertSchema), ...errors } },
  }, async (req) => forRequest(req, req.params.distributorId).list(req.query));

  app.get('/alerts/:alertId', {
    onRequest: app.authenticate,
    schema: { tags: ['alerts'], params: alertParam, response: { 200: alertSchema, ...errors } },
  }, async (req) => forRequest(req).get(req.params.alertId));

  app.post('/alerts/:alertId/respond', {
    onRequest: app.authenticate,
    schema: { tags: ['alerts'], params: alertParam, body: respondBody, response: { 200: alertSchema, ...errors } },
  }, async (req) => forRequest(req).respond(req.params.alertId, req.body.notes, req.body.photoUrls));

  app.post('/alerts/:alertId/status', {
    onRequest: app.authenticate,
    schema: { tags: ['alerts'], params: alertParam, body: alertStatusBody, response: { 200: alertSchema, ...errors } },
  }, async (req) => forRequest(req).setStatus(req.params.alertId, req.body.status, req.body.clearValue));
};
