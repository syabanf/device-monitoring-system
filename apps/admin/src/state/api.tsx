import * as React from 'react';
import type { IntegrationConfigView, RequestLogEntry, UnmatchedEvent } from '@monitoring/api-client';
import { ApiError } from '@monitoring/api-client';
import { API_URL } from './client';
import { useAppState } from './app-state';

export type IntegrationConfig = Omit<IntegrationConfigView, 'telegramTokenSet' | 'mqtt' | 'updatedAt'>;

interface ApiCtx {
  /** The channel settings the distribution center saved on the server. */
  config: IntegrationConfigView | null;
  saveConfig: (config: IntegrationConfig) => Promise<void>;
  /** The request log and the events that matched no device, both written by the API. */
  log: RequestLogEntry[];
  unmatched: UnmatchedEvent[];
  refresh: () => Promise<void>;
  health: () => Promise<{ ok: boolean; latencyMs: number; version: string }>;
  test: (channel: string) => Promise<{ ok: boolean; ms: number; message: string }>;
  apiUrl: string;
}
const Ctx = React.createContext<ApiCtx | null>(null);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { api, status } = useAppState();
  const [config, setConfig] = React.useState<IntegrationConfigView | null>(null);
  const [log, setLog] = React.useState<RequestLogEntry[]>([]);
  const [unmatched, setUnmatched] = React.useState<UnmatchedEvent[]>([]);

  const refresh = React.useCallback(async () => {
    const [cfg, entries, parked] = await Promise.all([api.integration.get(), api.integration.log(), api.integration.unmatched()]);
    setConfig(cfg);
    setLog(entries);
    setUnmatched(parked);
  }, [api]);

  React.useEffect(() => {
    if (status !== 'ready') return;
    void refresh().catch(() => setConfig(null));
  }, [status, refresh]);

  const saveConfig = React.useCallback(
    async (next: IntegrationConfig) => {
      setConfig(await api.integration.save(next));
    },
    [api],
  );

  const health = React.useCallback(async () => {
    const started = performance.now();
    const h = await api.health();
    return { ok: h.ok, latencyMs: Math.round(performance.now() - started), version: h.version };
  }, [api]);

  const value = React.useMemo<ApiCtx>(
    () => ({ config, saveConfig, log, unmatched, refresh, health, test: (channel) => api.integration.test(channel), apiUrl: API_URL }),
    [config, saveConfig, log, unmatched, refresh, health, api],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApi() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useApi outside ApiProvider');
  return ctx;
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  return err instanceof Error ? err.message : 'The request failed.';
}
