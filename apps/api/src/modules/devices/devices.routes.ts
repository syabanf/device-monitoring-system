import { deviceInput, deviceSchema, devicesQuery, distributorParam, id, page, problemSchema, sensorInput, sensorSchema } from '@monitoring/contracts';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { assertAdmin, assertTenant } from '../../plugins/auth';
import { devicesService } from './devices.service';

const deviceParam = distributorParam.extend({ deviceId: id('dev') });
const sensorParam = deviceParam.extend({ sensorId: id('sen') });
const errors = { 400: problemSchema, 401: problemSchema, 403: problemSchema, 404: problemSchema, 409: problemSchema };
const deviceWithSensors = z.object({ device: deviceSchema, sensors: z.array(sensorSchema) });

export const deviceRoutes: FastifyPluginAsyncZod = async (app) => {
  const scoped = (req: FastifyRequest, distributorId: string) =>
    devicesService(app.deps.db, assertTenant(req, distributorId));
  const adminScoped = (req: FastifyRequest, distributorId: string) => {
    assertAdmin(req);
    return scoped(req, distributorId);
  };

  app.get('/distributors/:distributorId/devices', {
    onRequest: app.authenticate,
    schema: { tags: ['devices'], params: distributorParam, querystring: devicesQuery, response: { 200: page(deviceSchema), ...errors } },
  }, async (req) => scoped(req, req.params.distributorId).list(req.query));

  app.get('/distributors/:distributorId/devices/:deviceId', {
    onRequest: app.authenticate,
    schema: { tags: ['devices'], params: deviceParam, response: { 200: deviceWithSensors, ...errors } },
  }, async (req) => scoped(req, req.params.distributorId).get(req.params.deviceId));

  app.post('/distributors/:distributorId/devices', {
    onRequest: app.authenticate,
    schema: { tags: ['devices'], params: distributorParam, body: deviceInput, response: { 201: deviceWithSensors, ...errors } },
  }, async (req, reply) => reply.status(201).send(await adminScoped(req, req.params.distributorId).create(req.body)));

  app.delete('/distributors/:distributorId/devices/:deviceId', {
    onRequest: app.authenticate,
    schema: { tags: ['devices'], params: deviceParam, response: { 204: z.null(), ...errors } },
  }, async (req, reply) => {
    await adminScoped(req, req.params.distributorId).remove(req.params.deviceId);
    return reply.status(204).send(null);
  });

  app.put('/distributors/:distributorId/devices/:deviceId/sensors/:sensorId', {
    onRequest: app.authenticate,
    schema: { tags: ['devices'], params: sensorParam, body: sensorInput, response: { 200: sensorSchema, ...errors } },
  }, async (req) => adminScoped(req, req.params.distributorId).upsertSensor(req.params.deviceId, req.params.sensorId, req.body));
};
