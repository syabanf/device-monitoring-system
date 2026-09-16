import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required, see apps/api/.env.example'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  WEBHOOK_SECRET: z.string().min(8, 'WEBHOOK_SECRET is required to verify Room Alert callbacks'),
  /** Without Redis the queue runs handlers inline, which keeps local development to one process. */
  REDIS_URL: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().default(900),
  DEVICE_TOKEN_TTL_SEC: z.coerce.number().int().default(60 * 60 * 24 * 30),
});

export type Env = z.infer<typeof schema>;

/** Parses once at boot and crashes with the missing keys listed, never half-configured. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${lines}`);
  }
  return parsed.data;
}

export const corsOrigins = (env: Env) => env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
