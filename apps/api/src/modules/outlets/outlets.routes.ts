import { distributorParam, id, outletInput, outletSchema, outletsQuery, page, problemSchema } from '@monitoring/contracts';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { assertAdmin, assertTenant } from '../../plugins/auth';
import { outletsService } from './outlets.service';

const outletParam = distributorParam.extend({ outletId: id('out') });
const errors = { 401: problemSchema, 403: problemSchema, 404: problemSchema, 409: problemSchema };

export const outletRoutes: FastifyPluginAsyncZod = async (app) => {
  const scoped = (req: FastifyRequest, distributorId: string) =>
    outletsService(app.deps.db, assertTenant(req, distributorId));
  const adminScoped = (req: FastifyRequest, distributorId: string) => {
    assertAdmin(req);
    return scoped(req, distributorId);
  };

  app.get('/distributors/:distributorId/outlets', {
    onRequest: app.authenticate,
    schema: { tags: ['outlets'], params: distributorParam, querystring: outletsQuery, response: { 200: page(outletSchema), ...errors } },
  }, async (req) => scoped(req, req.params.distributorId).list(req.query));

  app.get('/distributors/:distributorId/outlets/:outletId', {
    onRequest: app.authenticate,
    schema: { tags: ['outlets'], params: outletParam, response: { 200: outletSchema, ...errors } },
  }, async (req) => scoped(req, req.params.distributorId).get(req.params.outletId));

  app.post('/distributors/:distributorId/outlets', {
    onRequest: app.authenticate,
    schema: { tags: ['outlets'], params: distributorParam, body: outletInput, response: { 201: outletSchema, ...errors } },
  }, async (req, reply) => {
    const outlet = await adminScoped(req, req.params.distributorId).create(req.body);
    return reply.status(201).send(outlet);
  });

  app.put('/distributors/:distributorId/outlets/:outletId', {
    onRequest: app.authenticate,
    schema: { tags: ['outlets'], params: outletParam, body: outletInput, response: { 200: outletSchema, ...errors } },
  }, async (req) => adminScoped(req, req.params.distributorId).update(req.params.outletId, req.body));

  app.delete('/distributors/:distributorId/outlets/:outletId', {
    onRequest: app.authenticate,
    schema: { tags: ['outlets'], params: outletParam, response: { 204: z.null(), ...errors } },
  }, async (req, reply) => {
    await adminScoped(req, req.params.distributorId).remove(req.params.outletId);
    return reply.status(204).send(null);
  });
};
