import { adminLoginBody, loginResponse, problemSchema, tokenLoginBody } from '@monitoring/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { adminLogin, tokenLogin, type Principal } from './auth.service';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const issue = (p: Principal) => ({
    accessToken: app.jwt.sign(p.claims, { expiresIn: p.ttlSec }),
    expiresInSec: p.ttlSec,
    session: { ...p.claims, name: p.name, email: p.email },
  });

  app.post('/auth/admin/login', {
    schema: { tags: ['auth'], body: adminLoginBody, response: { 200: loginResponse, 401: problemSchema } },
  }, async (req) => issue(await adminLogin(app.deps.db, req.body.email, req.body.password, app.deps.env.ACCESS_TOKEN_TTL_SEC)));

  app.post('/auth/token/login', {
    schema: { tags: ['auth'], body: tokenLoginBody, response: { 200: loginResponse, 401: problemSchema } },
  }, async (req) => issue(await tokenLogin(app.deps.db, req.body.email, req.body.token, app.deps.env.DEVICE_TOKEN_TTL_SEC)));
};
