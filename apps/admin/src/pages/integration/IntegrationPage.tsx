import * as React from 'react';
import { Link } from 'react-router';
import { Activity, ArrowDownLeft, ArrowUpRight, Boxes, Check, Copy, Eye, EyeOff, Mail, Play, Plug, RefreshCw, Send, Smartphone, Trash2, Wand2, Zap } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, FormField, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, Textarea, Toggle, cn } from '@monitoring/ui';
import { API_REFERENCE, SAMPLE_EMAIL, SAMPLE_WEBHOOK, detectAndParse, maskSecret, randomSecret, type AlertEvent, type IntegrationConfig, type RequestLogEntry } from '@monitoring/integration';
import { fmtDateTime } from '@monitoring/fixtures';
import { useApi } from '../../state/api';
import { AlertStatusBadge } from '../../components/badges';

type View = 'channels' | 'blackbox' | 'log' | 'reference';
const CHANNELS: { key: RequestLogEntry['channel']; title: string; icon: React.ReactNode; desc: string; enabled: (c: IntegrationConfig) => boolean }[] = [
  { key: 'roomalert', title: 'Room Alert cloud → webhook', icon: <Zap />, desc: 'HTTP POST alert action from the AVTECH account hits the blackbox endpoint.', enabled: (c) => c.roomAlert.enabled },
  { key: 'email', title: 'Alert e-mail parser (IMAP)', icon: <Mail />, desc: 'Mail server → parsing engine for accounts without HTTP POST.', enabled: (c) => c.imap.enabled },
  { key: 'push', title: 'Mobile push (ANITS app)', icon: <Smartphone />, desc: 'Alert notification with respond system to registered employee phones.', enabled: (c) => c.push.enabled },
  { key: 'telegram', title: 'Telegram broadcast (ANBot)', icon: <Send />, desc: 'Broadcast message to registered chats per outlet.', enabled: (c) => c.telegram.enabled },
];

export function IntegrationPage() {
  const { api, config, setConfig, log, addLog, clearLog, ingestEvent } = useApi();
  const [view, setView] = React.useState<View>('channels');
  const [draft, setDraft] = React.useState<IntegrationConfig>(config);
  const [showKey, setShowKey] = React.useState(false);
  const [testing, setTesting] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Record<string, { ok: boolean; message: string; ms: number }>>({});
  const [health, setHealth] = React.useState<{ ok: boolean; latencyMs: number; version: string } | null>(null);
  const [payload, setPayload] = React.useState(SAMPLE_WEBHOOK);
  const [parsed, setParsed] = React.useState<AlertEvent | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [ingested, setIngested] = React.useState<{ ok: boolean; text: string; alertId?: number; tab?: string } | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(config);
  const webhookUrl = `${draft.apiBaseUrl.replace(/\/$/, '')}${draft.webhookPath}`;

  const test = async (ch: RequestLogEntry['channel']) => {
    setTesting(ch);
    try {
      const r = await api.testChannel(ch);
      setResults((x) => ({ ...x, [ch]: r }));
      addLog({ direction: 'outbound', channel: ch, method: 'POST', path: `/integrations/${ch}/test`, status: r.ok ? 200 : 502, ms: r.ms, summary: r.message });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'failed';
      setResults((x) => ({ ...x, [ch]: { ok: false, message: msg, ms: 0 } }));
      addLog({ direction: 'outbound', channel: ch, method: 'POST', path: `/integrations/${ch}/test`, status: 502, ms: 0, summary: msg });
    } finally { setTesting(null); }
  };
  const checkHealth = async () => {
    setTesting('health');
    try { const h = await api.health(); setHealth(h); addLog({ direction: 'outbound', channel: 'api', method: 'GET', path: '/health', status: 200, ms: h.latencyMs, summary: `${api.mode} · ${h.version}` }); }
    catch (e) { setHealth({ ok: false, latencyMs: 0, version: e instanceof Error ? e.message : 'error' }); addLog({ direction: 'outbound', channel: 'api', method: 'GET', path: '/health', status: 502, ms: 0, summary: 'unreachable' }); }
    finally { setTesting(null); }
  };
  const parse = () => { setIngested(null); try { setParsed(detectAndParse(payload)); setParseError(null); } catch (e) { setParsed(null); setParseError(e instanceof Error ? e.message : 'Cannot parse payload'); } };
  const ingest = () => {
    if (!parsed) return;
    const r = ingestEvent(parsed);
    addLog({ direction: 'inbound', channel: parsed.source === 'email' ? 'email' : 'roomalert', method: 'POST', path: parsed.source === 'email' ? '/webhooks/email' : config.webhookPath, status: r.ok ? 202 : 422, ms: 30 + Math.round(Math.random() * 40), summary: r.ok ? `${parsed.event} · ${r.alert.sensorName} · alert #${r.alert.id}` : r.error });
    if (r.ok) {
      addLog({ direction: 'outbound', channel: 'push', method: 'POST', path: '/integrations/push/send', status: 200, ms: 90 + Math.round(Math.random() * 80), summary: `Employees at outlet notified · alert #${r.alert.id}` });
      if (config.telegram.enabled) addLog({ direction: 'outbound', channel: 'telegram', method: 'POST', path: '/integrations/telegram/broadcast', status: 200, ms: 180 + Math.round(Math.random() * 120), summary: `ANBot broadcast · alert #${r.alert.id}` });
      setIngested({ ok: true, text: `Alert #${r.alert.id} ${r.alert.status === 'CLEARED' ? 'cleared' : 'created'} for ${r.alert.sensorName}.`, alertId: r.alert.id, tab: r.alert.status === 'CLEARED' ? 'cleared' : 'open' });
    } else setIngested({ ok: false, text: r.error });
  };
  const copy = (t: string) => { try { void navigator.clipboard.writeText(t); } catch { /* ignore */ } };
  const set = (patch: Partial<IntegrationConfig>) => setDraft({ ...draft, ...patch });

  return (
    <div className="space-y-4">
      <PageHeader title="API Integration" description="The blackbox between Room Alert, the mobile app, Telegram and this dashboard. Configure channels, replay payloads, watch the request log." actions={
        <>
          <Button asChild variant="outline"><Link to="/setup"><Wand2 />Setup wizard</Link></Button>
          <Button variant="outline" onClick={checkHealth} loading={testing === 'health'}><Activity />Check backend</Button>
          <Button onClick={() => setConfig(draft)} disabled={!dirty}><Check />Save settings</Button>
        </>
      } />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className={cn('md:col-span-2', config.mode === 'mock' ? 'bg-ink text-white' : 'bg-brand-600 text-white')}>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Boxes className="size-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/70">Adapter mode</p>
              <p className="text-xl font-bold">{config.mode === 'mock' ? 'Mock · fixtures + session store' : 'HTTP · live backend'}</p>
              <p className="truncate text-xs text-white/70">{config.mode === 'mock' ? 'Every API call is served locally. Switch to HTTP when the backend exists.' : config.apiBaseUrl}</p>
            </div>
            <Select value={draft.mode} onValueChange={(v) => set({ mode: v as IntegrationConfig['mode'] })}>
              <SelectTrigger className="w-32 border-white/30 bg-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="mock">Mock</SelectItem><SelectItem value="http">HTTP</SelectItem></SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted">Backend health</p>{health ? <><p className={cn('mt-2 text-2xl font-bold', !health.ok && 'text-brand-600')}>{health.ok ? 'Healthy' : 'Unreachable'}</p><p className="text-xs text-muted">{health.latencyMs} ms · {health.version}</p></> : <><p className="mt-2 text-2xl font-bold text-muted">—</p><p className="text-xs text-muted">Run “Check backend”</p></>}</CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted">Inbound today</p><p className="mt-2 text-2xl font-bold">{log.filter((l) => l.direction === 'inbound').length}</p><p className="text-xs text-muted">{log.filter((l) => l.direction === 'inbound' && l.status >= 400).length} rejected · {log.filter((l) => l.direction === 'outbound').length} outbound</p></CardContent></Card>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList variant="pill"><TabsTrigger value="channels">Channels & settings</TabsTrigger><TabsTrigger value="blackbox">Blackbox console</TabsTrigger><TabsTrigger value="log">Request log ({log.length})</TabsTrigger><TabsTrigger value="reference">API reference</TabsTrigger></TabsList>
      </Tabs>

      {view === 'channels' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
                    <Button size="sm" variant="outline" onClick={() => test(ch.key)} loading={testing === ch.key} disabled={!on}><Play />Test</Button>
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
                <FormField label="API base URL" htmlFor="i-base"><Input id="i-base" value={draft.apiBaseUrl} onChange={(e) => set({ apiBaseUrl: e.target.value })} className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
                <FormField label="API key" htmlFor="i-key"><Input id="i-key" type={showKey ? 'text' : 'password'} value={draft.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder="Bearer token for outbound calls" className="[&_input]:font-mono [&_input]:text-xs" rightSlot={<button type="button" className="p-1 text-muted" onClick={() => setShowKey((v) => !v)} aria-label="Toggle key">{showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>} /></FormField>
                <FormField label="Webhook URL (paste into the Room Alert account → Alert action → HTTP POST)" hint={`Secret: ${maskSecret(draft.webhookSecret)}`}>
                  <div className="flex gap-2"><Input readOnly value={webhookUrl} className="flex-1 [&_input]:bg-surface [&_input]:font-mono [&_input]:text-xs" /><Button type="button" variant="outline" onClick={() => copy(webhookUrl)} aria-label="Copy"><Copy /></Button><Button type="button" variant="outline" onClick={() => set({ webhookSecret: randomSecret() })}><RefreshCw />Secret</Button></div>
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Room Alert account e-mail" htmlFor="i-ra"><Input id="i-ra" value={draft.roomAlert.accountEmail} onChange={(e) => set({ roomAlert: { ...draft.roomAlert, accountEmail: e.target.value } })} /></FormField>
                  <FormField label="Device push interval (sec)" htmlFor="i-push"><Input id="i-push" type="number" min={30} value={draft.roomAlert.pushIntervalSec} onChange={(e) => set({ roomAlert: { ...draft.roomAlert, pushIntervalSec: Number(e.target.value) } })} /></FormField>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="size-4 text-muted" />IMAP mail parser</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField label="Host" htmlFor="i-host"><Input id="i-host" value={draft.imap.host} onChange={(e) => set({ imap: { ...draft.imap, host: e.target.value } })} /></FormField>
                <FormField label="Port" htmlFor="i-port"><Input id="i-port" type="number" value={draft.imap.port} onChange={(e) => set({ imap: { ...draft.imap, port: Number(e.target.value) } })} /></FormField>
                <FormField label="Mailbox user" htmlFor="i-user"><Input id="i-user" value={draft.imap.user} onChange={(e) => set({ imap: { ...draft.imap, user: e.target.value } })} /></FormField>
                <FormField label="Folder" htmlFor="i-folder"><Input id="i-folder" value={draft.imap.folder} onChange={(e) => set({ imap: { ...draft.imap, folder: e.target.value } })} /></FormField>
                <FormField label="Poll every (sec)" htmlFor="i-poll"><Input id="i-poll" type="number" min={15} value={draft.imap.pollSec} onChange={(e) => set({ imap: { ...draft.imap, pollSec: Number(e.target.value) } })} /></FormField>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Send className="size-4 text-muted" />Telegram ANBot & push</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField label="Bot token" htmlFor="i-bot"><Input id="i-bot" type="password" value={draft.telegram.botToken} onChange={(e) => set({ telegram: { ...draft.telegram, botToken: e.target.value } })} className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
                <FormField label="Default chat / channel id" htmlFor="i-chat"><Input id="i-chat" value={draft.telegram.chatId} onChange={(e) => set({ telegram: { ...draft.telegram, chatId: e.target.value } })} /></FormField>
                <FormField label="Push provider"><Select value={draft.push.provider} onValueChange={(v) => set({ push: { ...draft.push, provider: v as 'fcm' | 'webpush' } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fcm">Firebase Cloud Messaging</SelectItem><SelectItem value="webpush">Web Push (PWA)</SelectItem></SelectContent></Select></FormField>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {view === 'blackbox' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div><CardTitle>Replay a payload</CardTitle><p className="text-sm text-muted">Paste a Room Alert webhook JSON or an alert e-mail, parse it, then push it through the same pipeline the backend will use.</p></div>
              <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setPayload(SAMPLE_WEBHOOK); setParsed(null); setIngested(null); }}>Webhook sample</Button><Button size="sm" variant="outline" onClick={() => { setPayload(SAMPLE_EMAIL); setParsed(null); setIngested(null); }}>E-mail sample</Button></div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} className="min-h-72 font-mono text-xs" />
              {parseError ? <p className="text-xs text-brand-600">{parseError}</p> : null}
              <div className="flex gap-2"><Button variant="secondary" onClick={parse}><ArrowDownLeft />Parse</Button><Button onClick={ingest} disabled={!parsed}><Zap />Ingest into dashboard</Button></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Normalised event</CardTitle><p className="text-sm text-muted">What the blackbox hands to the alert engine.</p></CardHeader>
            <CardContent>
              {parsed ? (
                <>
                  <div className="mb-3 flex flex-wrap gap-2"><Badge variant="outline">{parsed.source}</Badge><AlertStatusBadge status={parsed.event === 'CLEARED' ? 'CLEARED' : 'TRIGGERED'} /><Badge variant="info">{parsed.sensorType}</Badge></div>
                  <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-xs leading-relaxed text-white">{JSON.stringify({ ...parsed, raw: undefined }, null, 2)}</pre>
                  {ingested ? <div className={cn('mt-3 flex items-center justify-between gap-3 rounded-2xl p-3 text-sm', ingested.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-brand-50 text-brand-700')}><span>{ingested.text}</span>{ingested.ok && ingested.alertId ? <Button asChild size="sm"><Link to={`/alerts?tab=${ingested.tab}&id=${ingested.alertId}`}>Open alert<ArrowUpRight /></Link></Button> : null}</div> : null}
                </>
              ) : <EmptyState icon={<Boxes />} title="Nothing parsed yet" description="Parse a payload on the left to see the normalised event." className="py-12" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {view === 'log' ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Request log</CardTitle><Button size="sm" variant="outline" onClick={clearLog}><Trash2 />Clear</Button></CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {log.length === 0 ? <EmptyState title="Log is empty" className="py-10" /> : log.map((l) => (
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
      ) : null}

      {view === 'reference' ? (
        <Card>
          <CardHeader><CardTitle>Endpoints the backend must implement</CardTitle><p className="text-sm text-muted">This is the contract of the blackbox adapter; the mock implements the same surface locally.</p></CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {API_REFERENCE.map((r) => (
              <div key={r.method + r.path} className="flex items-start gap-3 px-5 py-3">
                <Badge variant={r.method === 'GET' ? 'info' : 'brand'} className="w-14 justify-center font-mono">{r.method}</Badge>
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
