import { distributorParam, id, page, problemSchema, ticketInput, ticketPatch, ticketSchema, ticketsQuery } from '@monitoring/contracts';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertTenant } from '../../plugins/auth';
import { ticketsService } from './tickets.service';

const ticketParam = distributorParam.extend({ ticketId: id('MT') });
const errors = { 401: problemSchema, 403: problemSchema, 404: problemSchema, 409: problemSchema };

export const ticketRoutes: FastifyPluginAsyncZod = async (app) => {
  const scoped = (req: FastifyRequest, distributorId: string) =>
    ticketsService(app.deps.db, assertTenant(req, distributorId), app.deps.queue);

  app.get('/distributors/:distributorId/tickets', {
    onRequest: app.authenticate,
    schema: { tags: ['tickets'], params: distributorParam, querystring: ticketsQuery, response: { 200: page(ticketSchema), ...errors } },
  }, async (req) => scoped(req, req.params.distributorId).list(req.query));

  app.post('/distributors/:distributorId/tickets', {
    onRequest: app.authenticate,
    schema: { tags: ['tickets'], params: distributorParam, body: ticketInput, response: { 201: ticketSchema, ...errors } },
  }, async (req, reply) => reply.status(201).send(await scoped(req, req.params.distributorId).create(req.body)));

  app.patch('/distributors/:distributorId/tickets/:ticketId', {
    onRequest: app.authenticate,
    schema: { tags: ['tickets'], params: ticketParam, body: ticketPatch, response: { 200: ticketSchema, ...errors } },
  }, async (req) => scoped(req, req.params.distributorId).patch(req.params.ticketId, req.body));
};
