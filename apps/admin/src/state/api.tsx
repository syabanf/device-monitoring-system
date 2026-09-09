import * as React from 'react';
import type { Alert } from '@monitoring/types';
import { createHttpApi, createMockApi, loadConfig, saveConfig, type AlertEvent, type IntegrationConfig, type MonitoringApi, type RequestLogEntry } from '@monitoring/integration';
import { FIXTURE_NOW } from '@monitoring/fixtures';
import { categoryFor } from '@monitoring/integration';
import { useAppState } from './app-state';

interface ApiCtx {
  api: MonitoringApi;
  config: IntegrationConfig;
  setConfig: (c: IntegrationConfig) => void;
  log: RequestLogEntry[];
  addLog: (e: Omit<RequestLogEntry, 'id' | 'at'>) => void;
  clearLog: () => void;
  /** Map a parsed event onto master data and push it into the store. Returns the created alert or an error. */
  ingestEvent: (e: AlertEvent) => { ok: true; alert: Alert } | { ok: false; error: string };
}
const Ctx = React.createContext<ApiCtx | null>(null);

const SEED_LOG: Omit<RequestLogEntry, 'id'>[] = [
  { at: '2026-09-07T13:24:07+07:00', direction: 'inbound', channel: 'roomalert', method: 'POST', path: '/webhooks/roomalert', status: 202, ms: 38, summary: 'TRIGGERED · RA3-F88156-RA3S · Sales Area Temp & RH 29.79 °C' },
  { at: '2026-09-07T13:24:08+07:00', direction: 'outbound', channel: 'push', method: 'POST', path: '/integrations/push/send', status: 200, ms: 121, summary: '5 devices notified · IDM Margorejo 1' },
  { at: '2026-09-07T13:24:08+07:00', direction: 'outbound', channel: 'telegram', method: 'POST', path: '/integrations/telegram/broadcast', status: 200, ms: 240, summary: 'ANBot broadcast · 3 chats' },
  { at: '2026-09-07T13:10:02+07:00', direction: 'inbound', channel: 'email', method: 'POST', path: '/webhooks/email', status: 202, ms: 412, summary: 'Parsed alert mail 5724155 · TRIGGERED' },
  { at: '2026-09-07T12:55:41+07:00', direction: 'inbound', channel: 'roomalert', method: 'POST', path: '/webhooks/roomalert', status: 401, ms: 5, summary: 'Rejected · bad signature' },
];

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useAppState();
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const [config, setConfigState] = React.useState<IntegrationConfig>(loadConfig);
  const [log, setLog] = React.useState<RequestLogEntry[]>(() => SEED_LOG.map((e, i) => ({ ...e, id: `seed-${i}` })));
  const addLog = React.useCallback((e: Omit<RequestLogEntry, 'id' | 'at'>) => setLog((l) => [{ ...e, id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() }, ...l].slice(0, 200)), []);
  const setConfig = React.useCallback((c: IntegrationConfig) => { saveConfig(c); setConfigState(c); }, []);

  const ingestEvent = React.useCallback<ApiCtx['ingestEvent']>((e) => {
    const s = stateRef.current;
    const norm = (x: string | null | undefined) => (x ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const device = s.devices.find((d) => (e.mac && d.mac.toLowerCase() === e.mac.toLowerCase()) || (e.deviceSerial && norm(d.serial) === norm(e.deviceSerial)))
      ?? s.devices.find((d) => { const o = s.outlets.find((x) => x.id === d.outletId); return o && norm(e.deviceName).includes(norm(o.name.replace('Indomaret', 'IDM'))); });
    if (!device) return { ok: false, error: `No device matches serial "${e.deviceSerial ?? '—'}" / MAC "${e.mac ?? '—'}" / name "${e.deviceName}". Register the unit first.` };
    const outlet = s.outlets.find((o) => o.id === device.outletId)!;
    const sensors = s.sensors.filter((x) => x.deviceId === device.id);
    const sensor = sensors.find((x) => norm(e.sensorName).includes(norm(x.name)) || norm(x.name).includes(norm(e.sensorName.split('/')[0] ?? ''))) ?? sensors.find((x) => x.type === e.sensorType) ?? sensors[0];
    if (!sensor) return { ok: false, error: `Device ${device.serial} has no sensors configured.` };
    const maxId = s.alerts.reduce((m, a) => Math.max(m, a.id), 5723509);
    const id = e.externalAlertId && /^\d+$/.test(e.externalAlertId) && !s.alerts.some((a) => a.id === Number(e.externalAlertId)) ? Number(e.externalAlertId) : maxId + 1;
    const message = e.event === 'CLEARED' ? `Cleared: ${sensor.name}` : sensor.type === 'TEMPERATURE_HUMIDITY' || sensor.type === 'TEMPERATURE' ? (e.value.includes('%') ? 'Humidity above 60.0 %RH' : 'Temperature above 28.00 °C') : sensor.type === 'DOOR' ? 'Door opened outside operational hours' : sensor.type === 'MOTION' ? 'Motion detected outside operational hours' : sensor.type === 'POWER' ? 'Main power lost' : 'Panic button pressed';
    const alert: Alert = {
      id, distributorId: outlet.distributorId, outletId: outlet.id, deviceId: device.id, sensorId: sensor.id, sensorName: sensor.name, sensorType: sensor.type, category: categoryFor(sensor.type, e.at),
      status: e.event === 'CLEARED' ? 'RESOLVED' : 'UNACKNOWLEDGED', triggerValue: e.value || '—', triggerTime: e.at || FIXTURE_NOW, clearValue: e.event === 'CLEARED' ? e.value : null, clearTime: e.event === 'CLEARED' ? e.at : null, message, response: null, channels: config.telegram.enabled ? ['app', 'telegram'] : ['app'],
    };
    dispatch({ type: 'alerts/ingest', alert });
    return { ok: true, alert };
  }, [dispatch, config.telegram.enabled]);

  const api = React.useMemo<MonitoringApi>(() => (config.mode === 'http' && config.apiBaseUrl ? createHttpApi(config) : createMockApi({ outlets: () => stateRef.current.outlets, devices: () => stateRef.current.devices, alerts: () => stateRef.current.alerts, ingest: (e) => { const r = ingestEvent(e); return r.ok ? r.alert.id : null; } })), [config, ingestEvent]);

  return <Ctx.Provider value={{ api, config, setConfig, log, addLog, clearLog: () => setLog([]), ingestEvent }}>{children}</Ctx.Provider>;
}
export function useApi() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useApi outside ApiProvider');
  return ctx;
}
