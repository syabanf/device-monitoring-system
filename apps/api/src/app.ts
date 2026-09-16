import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { corsOrigins, type Env } from './env';
import { AppError, toProblem } from './lib/errors';
import { registerAuth } from './plugins/auth';
import type { Db } from './db/client';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { outletRoutes } from './modules/outlets/outlets.routes';
import { deviceRoutes } from './modules/devices/devices.routes';
import { alertRoutes } from './modules/alerts/alerts.routes';
import { ticketRoutes } from './modules/tickets/tickets.routes';
import { ingestionRoutes } from './ingestion/ingestion.routes';
import type { Queue } from './jobs/queue';

export interface AppDeps {
  env: Env;
  db: Db;
  queue: Queue;
}

/** Pure construction so tests can build an app without listening on a port. */
export async function buildApp({ env, db, queue }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.body.password', 'req.body.token'] },
    genReqId: () => crypto.randomUUID(),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('deps', { env, db, queue });

  await app.register(cors, { origin: corsOrigins(env), credentials: true });
  await app.register(swagger, {
    openapi: { info: { title: 'Monitoring API', version: '0.1.0' }, components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } } },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await registerAuth(app, env);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      if (err.status >= 500) req.log.error({ err }, err.code);
      return reply.status(err.status).type('application/problem+json').send(toProblem(err));
    }
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).type('application/problem+json').send({
        type: 'https://docs.monitoring.wit.id/errors/validation_failed',
        title: 'Request failed validation',
        status: 400,
        code: 'VALIDATION_FAILED',
        errors: err.validation.map((v) => ({ path: v.instancePath || v.params.issue.path.join('.'), message: v.params.issue.message })),
      });
    }
    req.log.error({ err }, 'unhandled');
    return reply.status(500).type('application/problem+json').send({
      type: 'https://docs.monitoring.wit.id/errors/internal', title: 'Internal server error', status: 500, code: 'INTERNAL',
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(outletRoutes);
  await app.register(deviceRoutes);
  await app.register(alertRoutes);
  await app.register(ticketRoutes);
  await app.register(ingestionRoutes);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
  }
}
