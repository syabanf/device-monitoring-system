/** Integration settings for the (future) backend. Persisted in localStorage by the admin app. */
export interface IntegrationConfig {
  mode: 'mock' | 'http';
  apiBaseUrl: string;
  apiKey: string;
  webhookPath: string;
  webhookSecret: string;
  roomAlert: { accountEmail: string; pushIntervalSec: number; enabled: boolean };
  imap: { host: string; port: number; user: string; folder: string; pollSec: number; enabled: boolean };
  telegram: { botToken: string; chatId: string; enabled: boolean };
  push: { provider: 'fcm' | 'webpush'; enabled: boolean };
}

export const DEFAULT_CONFIG: IntegrationConfig = {
  mode: 'mock',
  apiBaseUrl: 'https://api.monitoring.wit.id/v1',
  apiKey: '',
  webhookPath: '/webhooks/roomalert',
  webhookSecret: '',
  roomAlert: { accountEmail: 'alerts@indomaret.co.id', pushIntervalSec: 300, enabled: true },
  imap: { host: 'imap.gmail.com', port: 993, user: 'alerts@indomaret.co.id', folder: 'INBOX/RoomAlert', pollSec: 60, enabled: false },
  telegram: { botToken: '', chatId: '', enabled: false },
  push: { provider: 'fcm', enabled: true },
};

const KEY = 'ms.integration.config';
export function loadConfig(): IntegrationConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<IntegrationConfig>;
    return { ...DEFAULT_CONFIG, ...parsed, roomAlert: { ...DEFAULT_CONFIG.roomAlert, ...parsed.roomAlert }, imap: { ...DEFAULT_CONFIG.imap, ...parsed.imap }, telegram: { ...DEFAULT_CONFIG.telegram, ...parsed.telegram }, push: { ...DEFAULT_CONFIG.push, ...parsed.push } };
  } catch {
    return DEFAULT_CONFIG;
  }
}
export function saveConfig(c: IntegrationConfig) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}
export function randomSecret(len = 32): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
export function maskSecret(s: string): string {
  if (!s) return '—';
  return s.length <= 6 ? '••••••' : `${s.slice(0, 3)}••••••••${s.slice(-3)}`;
}
