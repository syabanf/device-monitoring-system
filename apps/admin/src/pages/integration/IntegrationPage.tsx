import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { Activity, ArrowDownLeft, ArrowUpRight, Boxes, Check, Copy, Inbox, Mail, Play, Plug, RefreshCw, Send, Smartphone, Wand2, Zap } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, FormField, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, Textarea, Toggle, cn } from '@monitoring/ui';
import { API_REFERENCE, SAMPLE_EMAIL, detectAndParse, type AlertEvent } from '@monitoring/integration';
import { fmtDateTime } from '@monitoring/fixtures';
import { describeError, useApi, type IntegrationConfig } from '../../state/api';
import { useScoped } from '../../state/app-state';
import { AlertStatusBadge } from '../../components/badges';

type View = 'channels' | 'blackbox' | 'log' | 'reference';
type ChannelKey = 'roomalert' | 'email' | 'push' | 'telegram';

const CHANNELS: { key: ChannelKey; title: string; icon: React.ReactNode; desc: string; enabled: (c: IntegrationConfig) => boolean }[] = [
  { key: 'roomalert', title: 'Room Alert cloud → webhook', icon: <Zap />, desc: 'HTTP POST alert action from the AVTECH account hits the ingestion endpoint.', enabled: (c) => c.roomAlert.enabled },
  { key: 'email', title: 'Alert e-mail parser (IMAP)', icon: <Mail />, desc: 'Mail server → parsing engine for accounts without HTTP POST.', enabled: (c) => c.imap.enabled },
  { key: 'push', title: 'Mobile push (ANITS app)', icon: <Smartphone />, desc: 'Alert notification with respond system to registered employee phones.', enabled: (c) => c.push.enabled },
  { key: 'telegram', title: 'Telegram broadcast (ANBot)', icon: <Send />, desc: 'Broadcast message to registered chats per outlet.', enabled: (c) => c.telegram.enabled },
];

export function IntegrationPage() {
  const { config, saveConfig, log, unmatched, refresh, health, test, send, apiUrl } = useApi();
  const { devices, sensors } = useScoped();
  const [params, setParams] = useSearchParams();
  const view = (['channels', 'blackbox', 'log', 'reference'].includes(params.get('view') ?? '') ? params.get('view') : 'channels') as View;
  const setView = (value: View) => { const next = new URLSearchParams(params); value === 'channels' ? next.delete('view') : next.set('view', value); setParams(next, { replace: true }); };

  const [draft, setDraft] = React.useState<IntegrationConfig | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Record<string, { ok: boolean; message: string; ms: number }>>({});
  const [status, setStatus] = React.useState<{ ok: boolean; latencyMs: number; version: string } | null>(null);
  const [payload, setPayload] = React.useState('');
  const [parsed, setParsed] = React.useState<AlertEvent | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<{ ok: boolean; text: string; alertId?: number | null } | null>(null);

  React.useEffect(() => {
    if (config) setDraft(stripped(config));
  }, [config]);

  // The sample names a unit that is actually registered, so Ingest lands on a real outlet.
  const sample = React.useMemo(() => {
    const device = devices[0];
    const sensor = device ? sensors.find((s) => s.deviceId === device.id && s.type === 'TEMPERATURE_HUMIDITY') : undefined;
    return JSON.stringify({
      alert_id: Math.floor(5_800_000 + Math.random() * 1000),
      event: 'triggered',
      device: { name: device?.serial ?? 'IDM Margorejo 1', serial: device?.serial ?? 'RA3-F88156-RA3S', mac: device?.mac ?? '00:80:A3:36:D1:DB' },
      sensor: { name: sensor?.name ?? 'Sales Area Temp & RH', type: sensor?.type ?? 'TEMPERATURE_HUMIDITY', value: 30.4, unit: '°C' },
      timestamp: new Date().toISOString(),
    }, null, 2);
  }, [devices, sensors]);
  React.useEffect(() => { if (!payload) setPayload(sample); }, [sample, payload]);

  const dirty = !!draft && !!config && JSON.stringify(draft) !== JSON.stringify(stripped(config));
  const webhookUrl = `${apiUrl}${config?.webhookPath ?? '/webhooks/roomalert'}`;

  const save = async () => {
    if (!draft) return;
    setBusy('save');
    try { await saveConfig(draft); } catch (err) { setResults((r) => ({ ...r, save: { ok: false, message: describeError(err), ms: 0 } })); } finally { setBusy(null); }
  };
  const runTest = async (channel: ChannelKey) => {
    setBusy(channel);
    try {
      const result = await test(channel);
      setResults((r) => ({ ...r, [channel]: result }));
    } catch (err) {
      setResults((r) => ({ ...r, [channel]: { ok: false, message: describeError(err), ms: 0 } }));
    } finally {
      setBusy(null);
      void refresh();
    }
  };
  const checkApi = async () => {
    setBusy('health');
    try { setStatus(await health()); }
    catch (err) { setStatus({ ok: false, latencyMs: 0, version: describeError(err) }); }
    finally { setBusy(null); }
  };
  const parse = () => { setSent(null); try { setParsed(detectAndParse(payload)); setParseError(null); } catch (err) { setParsed(null); setParseError(err instanceof Error ? err.message : 'Cannot parse payload'); } };
  const ingest = async () => {
    setBusy('ingest');
    try {
      const result = await send(payload, payload.trim().startsWith('{') ? 'webhook' : 'email');
      setSent(result.accepted
        ? { ok: true, text: `The API accepted the payload and raised alert #${result.alertId} in ${result.ms} ms.`, alertId: result.alertId }
        : { ok: false, text: result.reason || `The API answered ${result.status}.` });
    } catch (err) {
      setSent({ ok: false, text: describeError(err) });
    } finally { setBusy(null); }
  };
  const copy = (t: string) => { try { void navigator.clipboard.writeText(t); } catch { /* ignore */ } };
  const set = (patch: Partial<IntegrationConfig>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  if (!draft || !config) {
    return <div className="space-y-4"><PageHeader title="API Integration" description="Loading integration settings…" /><Card><CardContent className="p-10 text-sm text-muted">Loading channels and connection status…</CardContent></Card></div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="API Integration" description="Manage how Room Alert, the mobile app, Telegram, and this dashboard exchange data." actions={
        <>
          <Button asChild variant="outline"><Link to="/setup"><Wand2 />Setup wizard</Link></Button>
          <Button variant="outline" onClick={checkApi} loading={busy === 'health'}><Activity />Check connection</Button>
          <Button onClick={save} disabled={!dirty} loading={busy === 'save'}><Check />Save settings</Button>
        </>
      } />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="bg-brand-600 text-white md:col-span-2">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Boxes className="size-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/70">Live backend</p>
              <p className="text-xl font-bold">Every page reads this API</p>
              <p className="truncate font-mono text-xs text-white/70">{apiUrl}</p>
            </div>
            <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => copy(apiUrl)}><Copy />Copy</Button>
          </CardContent>
        </Card>
        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted">Backend health</p>{status ? <><p className={cn('mt-2 text-2xl font-bold', !status.ok && 'text-brand-600')}>{status.ok ? 'Healthy' : 'Unreachable'}</p><p className="text-xs text-muted">{status.latencyMs} ms · {status.version}</p></> : <><p className="mt-2 text-2xl font-bold text-muted">—</p><p className="text-xs text-muted">Run “Check backend”</p></>}</CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted">Inbound calls</p><p className="mt-2 text-2xl font-bold">{log.filter((l) => l.direction === 'inbound').length}</p><p className="text-xs text-muted">{log.filter((l) => l.status >= 400).length} rejected · {unmatched.length} unmatched</p></CardContent></Card>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList variant="pill"><TabsTrigger value="channels">Channels & settings</TabsTrigger><TabsTrigger value="blackbox">Blackbox console</TabsTrigger><TabsTrigger value="log">Request log ({log.length})</TabsTrigger><TabsTrigger value="reference">API reference</TabsTrigger></TabsList>
      </Tabs>

      {view === 'channels' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {CHANNELS.map((ch) => { const r = results[ch.key]; const on = ch.enabled(draft); return (
              <Card key={ch.key}>
                <CardContent className="flex items-start gap-4 p-5">
                  <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-5', on ? 'bg-ink text-white' : 'bg-surface text-muted')}>{ch.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="font-semibold">{ch.title}</p>{r ? <Badge variant={r.ok ? 'success' : 'brand'} dot>{r.ok ? `ok · ${r.ms} ms` : 'failed'}</Badge> : <Badge variant={on ? 'info' : 'muted'}>{on ? 'enabled' : 'disabled'}</Badge>}</div>
                    <p className="mt-0.5 text-sm text-muted">{ch.desc}</p>
                    {r ? <p className="mt-1 text-xs text-muted">{r.message}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => runTest(ch.key)} loading={busy === ch.key} disabled={!on}><Play />Test</Button>
                    <Toggle checked={on} label={ch.title} onCheckedChange={(v) => set(ch.key === 'roomalert' ? { roomAlert: { ...draft.roomAlert, enabled: v } } : ch.key === 'email' ? { imap: { ...draft.imap, enabled: v } } : ch.key === 'push' ? { push: { ...draft.push, enabled: v } } : { telegram: { ...draft.telegram, enabled: v } })} />
                  </div>
                </CardContent>
              </Card>
            ); })}
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Plug className="size-4 text-muted" />Backend & webhook</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Public API base URL" htmlFor="i-base" hint="What the Room Alert account and the mobile app should call."><Input id="i-base" value={draft.apiBaseUrl} onChange={(e) => set({ apiBaseUrl: e.target.value })} className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
                <FormField label="Webhook URL (paste into the Room Alert account → Alert action → HTTP POST)" hint="The signing secret lives in the API environment as WEBHOOK_SECRET and never reaches this page.">
                  <div className="flex gap-2"><Input readOnly value={webhookUrl} className="flex-1 [&_input]:bg-surface [&_input]:font-mono [&_input]:text-xs" /><Button type="button" variant="outline" onClick={() => copy(webhookUrl)} aria-label="Copy"><Copy /></Button></div>
                </FormField>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Room Alert account e-mail" htmlFor="i-ra"><Input id="i-ra" value={draft.roomAlert.accountEmail} onChange={(e) => set({ roomAlert: { ...draft.roomAlert, accountEmail: e.target.value } })} /></FormField>
                  <FormField label="Device push interval (sec)" htmlFor="i-push"><Input id="i-push" type="number" min={30} value={draft.roomAlert.pushIntervalSec} onChange={(e) => set({ roomAlert: { ...draft.roomAlert, pushIntervalSec: Number(e.target.value) } })} /></FormField>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="size-4 text-muted" />IMAP mail parser</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Host" htmlFor="i-host"><Input id="i-host" value={draft.imap.host} onChange={(e) => set({ imap: { ...draft.imap, host: e.target.value } })} /></FormField>
                <FormField label="Port" htmlFor="i-port"><Input id="i-port" type="number" value={draft.imap.port} onChange={(e) => set({ imap: { ...draft.imap, port: Number(e.target.value) } })} /></FormField>
                <FormField label="Mailbox user" htmlFor="i-user"><Input id="i-user" value={draft.imap.user} onChange={(e) => set({ imap: { ...draft.imap, user: e.target.value } })} /></FormField>
                <FormField label="Folder" htmlFor="i-folder"><Input id="i-folder" value={draft.imap.folder} onChange={(e) => set({ imap: { ...draft.imap, folder: e.target.value } })} /></FormField>
                <FormField label="Poll every (sec)" htmlFor="i-poll"><Input id="i-poll" type="number" min={15} value={draft.imap.pollSec} onChange={(e) => set({ imap: { ...draft.imap, pollSec: Number(e.target.value) } })} /></FormField>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Send className="size-4 text-muted" />Telegram ANBot & push</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Bot token" htmlFor="i-bot" hint={config.telegramTokenSet ? 'A token is stored. Leave this empty to keep it.' : 'Not set yet.'}><Input id="i-bot" type="password" value={draft.telegram.botToken} onChange={(e) => set({ telegram: { ...draft.telegram, botToken: e.target.value } })} placeholder={config.telegramTokenSet ? '••••••••' : 'Paste the BotFather token'} className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
                <FormField label="Default chat / channel id" htmlFor="i-chat"><Input id="i-chat" value={draft.telegram.chatId} onChange={(e) => set({ telegram: { ...draft.telegram, chatId: e.target.value } })} /></FormField>
                <FormField label="Push provider"><Select value={draft.push.provider} onValueChange={(v) => set({ push: { ...draft.push, provider: v as 'fcm' | 'webpush' } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fcm">Firebase Cloud Messaging</SelectItem><SelectItem value="webpush">Web Push (PWA)</SelectItem></SelectContent></Select></FormField>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {view === 'blackbox' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div><CardTitle>Replay a payload</CardTitle><p className="text-sm text-muted">Paste a Room Alert webhook JSON or an alert e-mail, parse it here, then post it to the API. The alert engine matches the device and raises the alert for real.</p></div>
              <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setPayload(sample); setParsed(null); setSent(null); }}>Webhook sample</Button><Button size="sm" variant="outline" onClick={() => { setPayload(SAMPLE_EMAIL); setParsed(null); setSent(null); }}>E-mail sample</Button></div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} className="min-h-72 font-mono text-xs" />
              {parseError ? <p className="text-xs text-brand-700" role="alert">{parseError}</p> : null}
              <div className="flex gap-2"><Button variant="secondary" onClick={parse}><ArrowDownLeft />Parse</Button><Button onClick={ingest} loading={busy === 'ingest'}><Zap />Send to the API</Button></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Normalised event</CardTitle><p className="text-sm text-muted">What the parser makes of the payload before the API sees it.</p></CardHeader>
            <CardContent>
              {parsed ? (
                <>
                  <div className="mb-3 flex flex-wrap gap-2"><Badge variant="outline">{parsed.source}</Badge><AlertStatusBadge status={parsed.event === 'CLEARED' ? 'RESOLVED' : 'UNACKNOWLEDGED'} /><Badge variant="info">{parsed.sensorType}</Badge></div>
                  <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-xs leading-relaxed text-white">{JSON.stringify({ ...parsed, raw: undefined }, null, 2)}</pre>
                </>
              ) : <EmptyState icon={<Boxes />} title="Nothing parsed yet" description="Parse a payload on the left to see the normalised event." className="py-12" />}
              {sent ? <div role={sent.ok ? 'status' : 'alert'} aria-live={sent.ok ? 'polite' : 'assertive'} className={cn('mt-3 flex items-center justify-between gap-3 rounded-2xl p-3 text-sm', sent.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-brand-50 text-brand-700')}><span>{sent.text}</span>{sent.ok && sent.alertId ? <Button asChild size="sm"><Link to={`/alerts?id=${sent.alertId}`}>Open alert<ArrowUpRight /></Link></Button> : null}</div> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {view === 'log' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Request log</CardTitle><Button size="sm" variant="outline" onClick={() => void refresh()}><RefreshCw />Refresh</Button></CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {log.length === 0 ? <EmptyState title="No calls yet" description="The API records every inbound webhook and outbound channel test here." className="py-10" /> : log.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', l.direction === 'inbound' ? 'bg-sky-100 text-sky-500' : 'bg-surface text-ink')}>{l.direction === 'inbound' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
                  <span className="w-36 shrink-0 text-xs text-muted">{fmtDateTime(l.at)}</span>
                  <Badge variant="outline" className="w-20 justify-center capitalize">{l.channel}</Badge>
                  <span className="w-56 shrink-0 truncate font-mono text-xs">{l.method} {l.path}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{l.summary}</span>
                  <Badge variant={l.status < 300 ? 'success' : l.status < 500 ? 'warning' : 'brand'}>{l.status}</Badge>
                  <span className="w-14 text-right text-xs tabular-nums text-muted">{l.ms} ms</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="size-4 text-muted" />Unmatched events</CardTitle><p className="text-sm text-muted">Payloads that named a device this distribution center does not have. Register the unit, then replay the payload.</p></CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {unmatched.length === 0 ? <EmptyState title="Nothing parked" className="py-10" /> : unmatched.map((e) => (
                <div key={e.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center gap-3"><span className="w-36 shrink-0 text-xs text-muted">{fmtDateTime(e.at)}</span><Badge variant="outline" className="capitalize">{e.source}</Badge><span className="min-w-0 flex-1 truncate text-muted">{e.reason}</span></div>
                  <pre className="mt-2 max-h-24 overflow-auto rounded-xl bg-surface p-3 font-mono text-[11px] leading-relaxed text-muted">{e.raw}</pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {view === 'reference' ? (
        <Card>
          <CardHeader><CardTitle>What the API serves</CardTitle><p className="text-sm text-muted">Both frontends call these endpoints. Every list is scoped to the token's distribution center, and an employee token narrows it again to their own outlets.</p></CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {API_REFERENCE.map((r) => (
              <div key={r.method + r.path} className="flex items-start gap-3 px-5 py-3">
                <Badge variant={r.method === 'GET' ? 'info' : 'brand'} className="w-16 justify-center font-mono">{r.method}</Badge>
                <div className="min-w-0 flex-1"><p className="font-mono text-sm">{r.path}</p><p className="text-xs text-muted">{r.description}</p></div>
                <Badge variant="outline">{r.direction}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function stripped(config: IntegrationConfig & { telegramTokenSet?: boolean; updatedAt?: string }): IntegrationConfig {
  return {
    apiBaseUrl: config.apiBaseUrl,
    webhookPath: config.webhookPath,
    roomAlert: { ...config.roomAlert },
    imap: { ...config.imap },
    telegram: { ...config.telegram },
    push: { ...config.push },
  };
}
