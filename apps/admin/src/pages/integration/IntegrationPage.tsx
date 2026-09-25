import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { Activity, Antenna, ArrowDownLeft, ArrowUpRight, Boxes, Check, Copy, Inbox, Play, Plug, RefreshCw, Send, Smartphone, Wand2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, FormField, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, Toggle, cn } from '@monitoring/ui';
import { API_REFERENCE } from '@monitoring/integration';
import { fmtDateTime } from '@monitoring/fixtures';
import type { MqttStatus } from '@monitoring/api-client';
import { describeError, useApi, type IntegrationConfig } from '../../state/api';

type View = 'channels' | 'log' | 'reference';
type ChannelKey = 'akcp' | 'push' | 'telegram';

const CHANNELS: { key: ChannelKey; title: string; icon: React.ReactNode; desc: string; enabled: (c: IntegrationConfig) => boolean }[] = [
  { key: 'push', title: 'Mobile push (ANITS app)', icon: <Smartphone />, desc: 'Alert notification with respond system to registered employee phones.', enabled: (c) => c.push.enabled },
  { key: 'telegram', title: 'Telegram broadcast (ANBot)', icon: <Send />, desc: 'Broadcast message to registered chats per outlet.', enabled: (c) => c.telegram.enabled },
];

export function IntegrationPage() {
  const { config, saveConfig, log, unmatched, refresh, health, test, apiUrl } = useApi();
  const [params, setParams] = useSearchParams();
  const view = (['channels', 'log', 'reference'].includes(params.get('view') ?? '') ? params.get('view') : 'channels') as View;
  const setView = (value: View) => { const next = new URLSearchParams(params); value === 'channels' ? next.delete('view') : next.set('view', value); setParams(next, { replace: true }); };

  const [draft, setDraft] = React.useState<IntegrationConfig | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Record<string, { ok: boolean; message: string; ms: number }>>({});
  const [status, setStatus] = React.useState<{ ok: boolean; latencyMs: number; version: string } | null>(null);

  React.useEffect(() => {
    if (config) setDraft(stripped(config));
  }, [config]);


  const dirty = !!draft && !!config && JSON.stringify(draft) !== JSON.stringify(stripped(config));

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
  const copy = (t: string) => { try { void navigator.clipboard.writeText(t); } catch { /* ignore */ } };
  const set = (patch: Partial<IntegrationConfig>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  if (!draft || !config) {
    return <div className="space-y-4"><PageHeader title="API Integration" description="Loading integration settings…" /><Card><CardContent className="p-10 text-sm text-muted">Loading channels and connection status…</CardContent></Card></div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="API Integration" description="Manage how the AKCP units, the mobile app, Telegram and this dashboard exchange data." actions={
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
        <TabsList variant="pill"><TabsTrigger value="channels">Channels & settings</TabsTrigger><TabsTrigger value="log">Request log ({log.length})</TabsTrigger><TabsTrigger value="reference">API reference</TabsTrigger></TabsList>
      </Tabs>

      {view === 'channels' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <MqttCard status={config.mqtt} result={results.akcp} busy={busy === 'akcp'} onTest={() => runTest('akcp')} />
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
                    <Toggle checked={on} label={ch.title} onCheckedChange={(v) => set(ch.key === 'push' ? { push: { ...draft.push, enabled: v } } : { telegram: { ...draft.telegram, enabled: v } })} />
                  </div>
                </CardContent>
              </Card>
            ); })}
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Plug className="size-4 text-muted" />Backend</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Public API base URL" htmlFor="i-base" hint="What the mobile app and this dashboard call."><Input id="i-base" value={draft.apiBaseUrl} onChange={(e) => set({ apiBaseUrl: e.target.value })} className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
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

      {view === 'log' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Request log</CardTitle><Button size="sm" variant="outline" onClick={() => void refresh()}><RefreshCw />Refresh</Button></CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {log.length === 0 ? <EmptyState title="No calls yet" description="The API records MQTT connection changes, alerts the units opened or closed, rejected messages and channel tests here." className="py-10" /> : log.map((l) => (
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
            <CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="size-4 text-muted" />Unmatched events</CardTitle><p className="text-sm text-muted">MQTT messages that matched no sensor. Register the unit, or bind its sensor key, and its next message lands.</p></CardHeader>
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

/** The AKCP units reach the API over MQTT, and the broker is set in the
 *  API environment, so this card reports the subscription rather than offering to edit it. */
function MqttCard({ status, result, busy, onTest }: {
  status: MqttStatus;
  result?: { ok: boolean; message: string; ms: number };
  busy: boolean;
  onTest: () => void;
}) {
  const state = !status.enabled ? 'off' : status.connected ? 'live' : 'down';
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-4">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-5', state === 'live' ? 'bg-ink text-white' : 'bg-surface text-muted')}><Antenna /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">AKCP sensorProbe+ → MQTT</p>
              <Badge variant={state === 'live' ? 'success' : state === 'down' ? 'brand' : 'muted'} dot={state !== 'off'}>
                {state === 'live' ? 'connected' : state === 'down' ? 'disconnected' : 'no broker'}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted">The units publish every reading and status change; the API holds one subscription for the whole fleet.</p>
            {result ? <p className="mt-1 text-xs text-muted">{result.message}</p> : status.lastError ? <p className="mt-1 text-xs text-brand-700">{status.lastError}</p> : null}
          </div>
          <Button size="sm" variant="outline" onClick={onTest} loading={busy}><Play />Test</Button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-muted">Broker</dt>
            <dd className="truncate font-mono">{status.brokerUrl || 'MQTT_BROKER_URL is empty'}</dd>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-muted">Topic filter</dt>
            <dd className="truncate font-mono">{status.topicFilter}</dd>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-muted">Messages</dt>
            <dd className="font-semibold tabular-nums">{status.received} in · {status.stored} stored</dd>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-muted">Last message</dt>
            <dd className="truncate">{status.lastMessageAt ? fmtDateTime(status.lastMessageAt) : '—'}</dd>
          </div>
        </dl>
        {status.unmatched > 0 || status.dropped > 0 ? (
          <p className="text-xs text-muted">{status.unmatched} message(s) matched no sensor{status.dropped > 0 ? `, ${status.dropped} dropped when the queue filled` : ''}. The unmatched list is under the request log.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function stripped(config: IntegrationConfig & { telegramTokenSet?: boolean; updatedAt?: string }): IntegrationConfig {
  return {
    apiBaseUrl: config.apiBaseUrl,
    telegram: { ...config.telegram },
    push: { ...config.push },
  };
}
