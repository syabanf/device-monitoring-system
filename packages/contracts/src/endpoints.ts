import { z } from 'zod';
import { alertCategory, alertStatus, deviceStatus, ticketStatus } from './entities';
import { id, isoDateTime, pageQuery } from './primitives';

export const healthResponse = z.object({
  ok: z.boolean(), version: z.string(), uptimeSec: z.number(), db: z.enum(['up', 'down']), queue: z.enum(['up', 'down', 'inline']),
});

/** Admin signs in with a password; employees and technicians exchange the admin-issued token. */
export const adminLoginBody = z.object({ email: z.string().email(), password: z.string().min(6) });
export const tokenLoginBody = z.object({ email: z.string().email(), token: z.string().min(6) });
export const sessionClaims = z.object({
  sub: z.string(), kind: z.enum(['admin', 'employee', 'technician']), distributorId: id('dst'),
  outletIds: z.array(id('out')).optional(), role: z.string().optional(),
});
export const loginResponse = z.object({
  accessToken: z.string(), expiresInSec: z.number().int(), session: sessionClaims.extend({ name: z.string(), email: z.string().email() }),
});
export type SessionClaims = z.infer<typeof sessionClaims>;

export const outletsQuery = pageQuery.extend({ q: z.string().optional() });
export const devicesQuery = pageQuery.extend({ outletId: id('out').optional(), status: deviceStatus.optional() });
export const alertsQuery = pageQuery.extend({
  outletId: id('out').optional(), status: alertStatus.optional(), category: alertCategory.optional(), since: isoDateTime.optional(),
});
export const ticketsQuery = pageQuery.extend({
  outletId: id('out').optional(), status: ticketStatus.optional(), technicianId: id('tech').optional(),
});

export const respondBody = z.object({ notes: z.string().min(1), photoUrls: z.array(z.string()).default([]) });
export const alertStatusBody = z.object({ status: alertStatus, clearValue: z.string().optional() });

/** Room Alert cloud HTTP POST action. Unknown keys pass through to the parser. */
export const roomAlertWebhookBody = z.object({
  alert_id: z.union([z.string(), z.number()]).optional(),
  event: z.string().optional(),
  device: z.object({ name: z.string().optional(), serial: z.string().optional(), mac: z.string().optional(), location: z.string().optional() }).optional(),
  sensor: z.object({ name: z.string().optional(), type: z.string().optional(), value: z.union([z.string(), z.number()]).optional(), unit: z.string().optional() }).optional(),
  timestamp: z.string().optional(),
}).passthrough();
export const emailWebhookBody = z.object({ raw: z.string().min(1) });
export const ingestResponse = z.object({ accepted: z.boolean(), alertId: z.number().int().nullable(), reason: z.string().optional() });

/** Route table, kept beside the schemas so tests and docs cannot drift from the server. */
export const ROUTES = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/auth/admin/login' },
  { method: 'POST', path: '/auth/token/login' },
  { method: 'GET', path: '/distributors/:distributorId/outlets' },
  { method: 'POST', path: '/distributors/:distributorId/outlets' },
  { method: 'PUT', path: '/distributors/:distributorId/outlets/:outletId' },
  { method: 'DELETE', path: '/distributors/:distributorId/outlets/:outletId' },
  { method: 'GET', path: '/distributors/:distributorId/devices' },
  { method: 'POST', path: '/distributors/:distributorId/devices' },
  { method: 'DELETE', path: '/distributors/:distributorId/devices/:deviceId' },
  { method: 'PUT', path: '/distributors/:distributorId/devices/:deviceId/sensors/:sensorId' },
  { method: 'GET', path: '/distributors/:distributorId/alerts' },
  { method: 'POST', path: '/alerts/:alertId/respond' },
  { method: 'POST', path: '/alerts/:alertId/status' },
  { method: 'GET', path: '/distributors/:distributorId/tickets' },
  { method: 'POST', path: '/distributors/:distributorId/tickets' },
  { method: 'PATCH', path: '/distributors/:distributorId/tickets/:ticketId' },
  { method: 'POST', path: '/webhooks/roomalert' },
  { method: 'POST', path: '/webhooks/email' },
] as const;
