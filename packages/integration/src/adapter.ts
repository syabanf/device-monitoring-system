import type { Alert, Device, Outlet } from '@monitoring/types';
import type { AlertEvent } from './parsers';
import type { IntegrationConfig } from './config';

export interface RequestLogEntry {
  id: string;
  at: string;
  direction: 'inbound' | 'outbound';
  channel: 'roomalert' | 'email' | 'telegram' | 'push' | 'api';
  method: string;
  path: string;
  status: number;
  ms: number;
  summary: string;
}

/**
 * The blackbox contract: the UI only talks to this interface.
 * `MockApi` serves the static fixtures + session store; `HttpApi` calls the real backend when it exists.
 */
export interface MonitoringApi {
  readonly mode: 'mock' | 'http';
  health(): Promise<{ ok: boolean; latencyMs: number; version: string }>;
  listOutlets(distributorId: string): Promise<Outlet[]>;
  listDevices(distributorId: string): Promise<Device[]>;
  listAlerts(distributorId: string): Promise<Alert[]>;
  ingest(event: AlertEvent): Promise<{ accepted: boolean; alertId: number | null }>;
  testChannel(channel: RequestLogEntry['channel']): Promise<{ ok: boolean; ms: number; message: string }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (base: number) => Math.round(base + Math.random() * base);

export function createMockApi(read: { outlets: () => Outlet[]; devices: () => Device[]; alerts: () => Alert[]; ingest: (e: AlertEvent) => number | null }): MonitoringApi {
  return {
    mode: 'mock',
    async health() { const ms = jitter(40); await sleep(ms); return { ok: true, latencyMs: ms, version: 'mock-0.1.0' }; },
    async listOutlets(d) { await sleep(jitter(30)); return read.outlets().filter((o) => o.distributorId === d); },
    async listDevices(d) { await sleep(jitter(30)); const ids = new Set(read.outlets().filter((o) => o.distributorId === d).map((o) => o.id)); return read.devices().filter((x) => ids.has(x.outletId)); },
    async listAlerts(d) { await sleep(jitter(30)); return read.alerts().filter((a) => a.distributorId === d); },
    async ingest(e) { await sleep(jitter(60)); const id = read.ingest(e); return { accepted: id != null, alertId: id }; },
    async testChannel(channel) {
      const ms = jitter(channel === 'email' ? 400 : 120);
      await sleep(ms);
      const msg: Record<RequestLogEntry['channel'], string> = { roomalert: 'Webhook endpoint reachable, signature verified', email: 'IMAP login ok, 0 unread alert mails', telegram: 'Bot getMe ok', push: 'FCM credentials valid', api: 'API responded 200' };
      return { ok: true, ms, message: msg[channel] };
    },
  };
}

export function createHttpApi(config: IntegrationConfig): MonitoringApi {
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` });
  const url = (p: string) => `${config.apiBaseUrl.replace(/\/$/, '')}${p}`;
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(url(path), { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    mode: 'http',
    async health() { const t = performance.now(); const r = await call<{ version: string }>('GET', '/health'); return { ok: true, latencyMs: Math.round(performance.now() - t), version: r.version }; },
    listOutlets: (d) => call('GET', `/distributors/${d}/outlets`),
    listDevices: (d) => call('GET', `/distributors/${d}/devices`),
    listAlerts: (d) => call('GET', `/distributors/${d}/alerts`),
    ingest: (e) => call('POST', config.webhookPath, e),
    async testChannel(channel) { const t = performance.now(); await call('POST', `/integrations/${channel}/test`); return { ok: true, ms: Math.round(performance.now() - t), message: 'ok' }; },
  };
}

export const API_REFERENCE: { method: string; path: string; description: string; direction: 'inbound' | 'outbound' }[] = [
  { method: 'POST', path: '/webhooks/roomalert', description: 'Room Alert cloud HTTP POST alert action (triggered / cleared). Signed with the webhook secret.', direction: 'inbound' },
  { method: 'POST', path: '/webhooks/email', description: 'Parsed Room Alert alert e-mail from the IMAP poller (mail server → parsing engine).', direction: 'inbound' },
  { method: 'GET', path: '/health', description: 'Backend health and version.', direction: 'outbound' },
  { method: 'GET', path: '/distributors/{id}/outlets', description: 'Master data: outlets for a distribution center.', direction: 'outbound' },
  { method: 'GET', path: '/distributors/{id}/devices', description: 'Room Alert units and their sensors / port map.', direction: 'outbound' },
  { method: 'GET', path: '/distributors/{id}/alerts', description: 'Notification, respond and history lists.', direction: 'outbound' },
  { method: 'POST', path: '/alerts/{id}/respond', description: 'Employee field response with notes and photo proof (mobile app).', direction: 'outbound' },
  { method: 'POST', path: '/alerts/{id}/clear', description: 'Admin clears an alert manually.', direction: 'outbound' },
  { method: 'POST', path: '/integrations/telegram/broadcast', description: 'Broadcast alert message to registered ANBot chats.', direction: 'outbound' },
  { method: 'POST', path: '/integrations/push/send', description: 'Push notification to registered employee phones.', direction: 'outbound' },
];
