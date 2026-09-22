import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { ArrowUpRight, BellRing, CheckCircle2, Clock, Droplets, ExternalLink, MapPin, Radio, Router, Thermometer, UserPlus, WifiOff, Wrench, LayoutDashboard } from 'lucide-react';
import type { Alert, Outlet } from '@monitoring/types';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Chip, EmptyState, Readout, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, cn, BRAND
} from '@monitoring/ui';
import {
  nowMs, avgResponseSec, fmtAgo, humanizeShort, inPeriod, isSolved, isTicketOverdue, openVsSolved, type Period,
} from '@monitoring/fixtures';
import { useScoped } from '../../state/app-state';
import { latestReadingBySensor, useReadingSeries } from '../../state/readings';
import { AlertListItem, alertHref } from '../../components/AlertListItem';
import { SensorIcon } from '../../components/badges';
import { MaintenanceDashboard } from './MaintenanceDashboard';
import { MaintenanceSummary } from './MaintenanceSummary';
import { isSetupDone } from '../setup/SetupWizardPage';
import { Wand2 as WandIcon, X } from 'lucide-react';

type Filter = 'all' | 'COMFORT' | 'SECURITY';

function AlertColumn({ title, alerts, tab }: { title: string; alerts: Alert[]; tab: string }) {
  const [params, setParams] = useSearchParams();
  const key = `${tab}Category`;
  const filter = (params.get(key) === 'COMFORT' || params.get(key) === 'SECURITY' ? params.get(key) : 'all') as Filter;
  const setFilter = (value: Filter) => { const next = new URLSearchParams(params); value === 'all' ? next.delete(key) : next.set(key, value); setParams(next, { replace: true }); };
  const list = filter === 'all' ? alerts : alerts.filter((a) => a.category === filter);
  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            {title}
            <Badge variant="default" className="px-2.5 text-sm font-semibold">{list.length}</Badge>
          </CardTitle>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger variant="ghost" className="-ml-3 mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="COMFORT">Shopping Comfort</SelectItem>
              <SelectItem value="SECURITY">Outlet Security</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild variant="outline" size="sm"><Link to={`/alerts?tab=${tab}`}>View all<ArrowUpRight /></Link></Button>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {list.length === 0 ? <EmptyState title="No alerts" description="Nothing in this list for the selected filter." className="py-8" /> : list.slice(0, 5).map((a) => <AlertListItem key={a.id} alert={a} compact />)}
      </CardContent>
    </Card>
  );
}

function HeroOutlet({ outlet, alerts }: { outlet: Outlet; alerts: Alert[] }) {
  const { sensorsByOutlet, devicesByOutlet } = useScoped();
  const sensors = sensorsByOutlet.get(outlet.id) ?? [];
  const temp = sensors.find((s) => s.type === 'TEMPERATURE_HUMIDITY');
  const reading = temp ? latestReadingBySensor.get(temp.id) : undefined;
  const devices = devicesByOutlet.get(outlet.id) ?? [];
  const online = devices.filter((d) => d.status === 'online').length;
  const open = alerts.filter((a) => a.outletId === outlet.id && !isSolved(a));
  const openSensorIds = new Set(open.map((a) => a.sensorId));
  const latest = open[0];
  return (
    <Card className="relative flex flex-col overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-sky-300/10 blur-3xl" />
      <CardHeader className="relative flex-row items-start justify-between space-y-0">
        <div>
          <p className="text-xs font-medium text-sidebar-muted">Featured outlet</p>
          <CardTitle className="text-2xl text-white">{outlet.name}</CardTitle>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-sidebar-muted"><MapPin className="size-3.5" />{outlet.address}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
          <span className={cn('size-1.5 rounded-full', online ? 'bg-emerald-400' : 'bg-silver')} />{online ? 'Live' : 'Offline'}
        </span>
      </CardHeader>
      <CardContent className="relative flex flex-1 flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
          <div>
            <p className="text-xs text-sidebar-muted">{temp?.name ?? 'Temperature'}</p>
            <div className="flex items-start gap-1 leading-none">
              <span className="text-6xl font-bold tracking-tight">{reading ? reading.temperatureC.toFixed(1) : '—'}</span>
              <span className="pt-2 text-lg font-semibold text-sidebar-muted">°C</span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-sidebar-muted"><Droplets className="size-4" />{reading ? `${reading.humidityPct.toFixed(0)} %RH` : '—'} · updated {reading ? fmtAgo(reading.at) : '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {sensors.map((s) => (
              <span key={s.id} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium', openSensorIds.has(s.id) ? 'bg-brand-600 text-white' : 'bg-white/10 text-white')}>
                <SensorIcon type={s.type} className="size-3.5" />{s.name}
              </span>
            ))}
          </div>
        </div>
        {latest ? (
          <Link to={alertHref(latest)} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 transition-colors hover:bg-white/10">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-600"><SensorIcon type={latest.sensorType} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{latest.message}</span>
              <span className="block text-xs text-sidebar-muted">{latest.sensorName} · {fmtAgo(latest.triggerTime)} · {open.length} open</span>
            </span>
            <ArrowUpRight className="size-4 text-sidebar-muted" />
          </Link>
        ) : (
          <div className="rounded-2xl bg-white/5 p-3 text-sm text-sidebar-muted">No open alerts at this outlet.</div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Chip label={`${devices.length} device${devices.length > 1 ? 's' : ''}`} className="border-white/10 bg-white/10 text-white hover:bg-white/20"><Router /></Chip>
          <Chip label={`${online} online`} className="border-white/10 bg-white/10 text-white hover:bg-white/20"><Radio /></Chip>
          <Chip label={`${outlet.openTime}–${outlet.closeTime}`} className="border-white/10 bg-white/10 text-white hover:bg-white/20"><Clock /></Chip>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="outline" size="sm" className="border-white/15 bg-transparent text-white hover:bg-white/10"><a href={outlet.mapsUrl} target="_blank" rel="noreferrer"><ExternalLink />Maps</a></Button>
            <Button asChild size="sm"><Link to={`/outlets/${outlet.id}`}>Open outlet</Link></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: 'all', label: 'All time' },
];

function AttentionRequired() {
  const { alerts, devices, tickets, employees, outletById } = useScoped();
  const awaiting = alerts.filter((a) => a.status === 'UNACKNOWLEDGED').sort((a, b) => (a.category === b.category ? b.triggerTime.localeCompare(a.triggerTime) : a.category === 'SECURITY' ? -1 : 1));
  const offline = devices.filter((d) => d.status === 'offline');
  const overdue = tickets.filter(isTicketOverdue);
  const pending = employees.filter((e) => e.registrationStatus === 'pending');
  const total = awaiting.length + offline.length + overdue.length + pending.length;
  return (
    <section aria-labelledby="attention-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Operations queue</p><h2 id="attention-title" className="mt-1 text-xl font-bold">Attention required</h2></div><Badge variant={total ? 'brand' : 'success'}>{total ? `${total} items` : 'All clear'}</Badge></div>
      {total ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(24rem,1fr)]">
        <Card className="overflow-hidden border-brand-100"><CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 bg-brand-50 pb-3"><div><CardTitle className="flex items-center gap-2"><BellRing className="size-5 text-brand-600" />Alerts awaiting response</CardTitle><p className="mt-1 text-xs text-muted">Security alerts appear first</p></div><Button asChild size="sm"><Link to="/alerts?tab=unacknowledged">Review all<ArrowUpRight /></Link></Button></CardHeader><CardContent className="space-y-2 pt-4">
          {awaiting.slice(0, 4).map((alert) => <Link key={alert.id} to={`/alerts?tab=unacknowledged&id=${alert.id}`} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 hover:bg-white hover:shadow-card"><span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', alert.category === 'SECURITY' ? 'bg-brand-600 text-white' : 'bg-sky-100 text-sky-700')}><SensorIcon type={alert.sensorType} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{alert.message}</span><span className="block truncate text-xs text-muted">{outletById.get(alert.outletId)?.name} · {fmtAgo(alert.triggerTime)}</span></span><Badge variant={alert.category === 'SECURITY' ? 'brand' : 'info'}>{alert.category === 'SECURITY' ? 'High' : 'Comfort'}</Badge></Link>)}
          {!awaiting.length ? <p className="py-6 text-center text-sm text-muted">No alerts are waiting for a response.</p> : null}
        </CardContent></Card>
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-1">
          <Link to="/devices?status=offline" className="flex flex-col items-start gap-3 rounded-card bg-white p-4 shadow-card transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-4"><span className="flex size-11 items-center justify-center rounded-full bg-ink text-white"><WifiOff className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-2xl font-bold">{offline.length}</span><span className="block text-xs text-muted">offline devices</span></span><ArrowUpRight className="hidden size-4 text-muted sm:block" /></Link>
          <Link to="/devices/maintenance?view=tickets" className="flex flex-col items-start gap-3 rounded-card bg-white p-4 shadow-card transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-4"><span className="flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Wrench className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-2xl font-bold">{overdue.length}</span><span className="block text-xs text-muted">overdue tickets</span></span><ArrowUpRight className="hidden size-4 text-muted sm:block" /></Link>
          <Link to="/users?status=pending" className="flex flex-col items-start gap-3 rounded-card bg-white p-4 shadow-card transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-4"><span className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-500"><UserPlus className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-2xl font-bold">{pending.length}</span><span className="block text-xs text-muted">pending registrations</span></span><ArrowUpRight className="hidden size-4 text-muted sm:block" /></Link>
        </div>
      </div> : <Card><CardContent className="flex items-center gap-4 p-5"><span className="flex size-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="size-5" /></span><div><p className="font-semibold">Everything is under control</p><p className="text-sm text-muted">No unacknowledged alerts, offline devices, overdue tickets, or pending registrations.</p></div></CardContent></Card>}
    </section>
  );
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'maintenance' ? 'maintenance' : 'operations';
  const setView = (v: 'operations' | 'maintenance') => { const next = new URLSearchParams(params); v === 'maintenance' ? next.set('view', v) : next.delete('view'); setParams(next, { replace: true }); };
  const [showSetup, setShowSetup] = React.useState(() => !isSetupDone());
  return (
    <div className="space-y-4">
      {showSetup ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-sky-100 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-white text-sky-500"><WandIcon className="size-4" /></span>
          <p className="min-w-[12rem] flex-1 text-sm"><span className="font-semibold">New distribution center?</span> <span className="text-body/70">Run the setup wizard to add outlets, Room Alert units, employees and the API integration in one go.</span></p>
          <Button asChild size="sm"><Link to="/setup">Start setup</Link></Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Dismiss" onClick={() => setShowSetup(false)}><X /></Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-white p-1 shadow-card">
          {([['operations', 'Operations', LayoutDashboard], ['maintenance', 'Maintenance', Wrench]] as const).map(([v, label, Icon]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn('inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors', view === v ? 'bg-ink text-white' : 'text-muted hover:text-foreground')}><Icon className="size-4" />{label}</button>
          ))}
        </div>
        <p className="hidden text-xs text-muted md:block">{view === 'maintenance' ? 'Point of view: hardware maintenance team' : 'Point of view: outlet operations'}</p>
      </div>
      {view === 'maintenance' ? <MaintenanceDashboard /> : <OperationsDashboard />}
    </div>
  );
}

function OperationsDashboard() {
  const { alerts, outlets, employees, devices, sensorsByOutlet } = useScoped();
  const [params, setParams] = useSearchParams();
  const period = (PERIODS.some((p) => p.value === params.get('period')) ? params.get('period') : '7d') as Period;
  const setPeriod = (value: Period) => { const next = new URLSearchParams(params); value === '7d' ? next.delete('period') : next.set('period', value); setParams(next, { replace: true }); };

  const open = React.useMemo(() => alerts.filter((a) => !isSolved(a)), [alerts]);
  const solved = React.useMemo(() => alerts.filter(isSolved), [alerts]);
  const inRange = React.useMemo(() => alerts.filter((a) => inPeriod(a, period)), [alerts, period]);
  const stats = openVsSolved(inRange);
  const avg = avgResponseSec(inRange);
  const onlineDevices = devices.filter((d) => d.status === 'online').length;
  const pending = employees.filter((e) => e.registrationStatus === 'pending').length;
  const awaiting = open.filter((a) => a.status === 'UNACKNOWLEDGED').length;
  const responded = open.length - awaiting;

  const featured = React.useMemo(() => {
    const first = open[0];
    return outlets.find((o) => o.id === first?.outletId) ?? outlets[0]!;
  }, [open, outlets]);

  // The comfort tile averages today's readings, so it asks the API for the last day rather than
  // holding every sample in memory.
  const day = React.useMemo(() => ({ from: new Date(nowMs() - 24 * 3_600_000).toISOString(), to: new Date().toISOString(), bucket: 'hour' as const }), []);
  const { readings } = useReadingSeries(day);
  const { avgTemp, avgHum, spark } = React.useMemo(() => {
    const ids = new Set(outlets.flatMap((o) => (sensorsByOutlet.get(o.id) ?? []).filter((s) => s.type === 'TEMPERATURE_HUMIDITY').map((s) => s.id)));
    let t = 0, h = 0, n = 0;
    for (const id of ids) { const r = latestReadingBySensor.get(id); if (r) { t += r.temperatureC; h += r.humidityPct; n++; } }
    const buckets = new Map<number, { t: number; n: number }>();
    for (const r of readings) {
      if (!ids.has(r.sensorId)) continue;
      const k = Math.floor(Date.parse(r.at) / 3_600_000);
      const b = buckets.get(k) ?? { t: 0, n: 0 };
      b.t += r.temperatureC; b.n++; buckets.set(k, b);
    }
    const spark = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([k, b]) => ({ k, v: b.t / b.n }));
    return { avgTemp: n ? t / n : null, avgHum: n ? h / n : null, spark };
  }, [outlets, sensorsByOutlet, readings]);

  const donut = [
    { name: 'Solved Alert', value: stats.solved, color: BRAND.ink },
    { name: 'Open Alert', value: stats.open, color: BRAND.accent },
  ];

  return (
    <div className="space-y-4">
      <AttentionRequired />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <HeroOutlet outlet={featured} alerts={alerts} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card className="col-span-2 bg-brand-600 text-white">
            <CardContent className="flex flex-col gap-5 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Awaiting response</p>
                  <p className="mt-1 text-5xl font-bold leading-none tracking-tight">{awaiting}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20"><Link to="/alerts?tab=unacknowledged">Open list<ArrowUpRight /></Link></Button>
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/80"><span>{responded} responded, waiting to clear</span><span>{open.length} open total</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${open.length ? (responded / open.length) * 100 : 0}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted">Temperature</p>
                <span className="flex size-9 items-center justify-center rounded-full bg-sky-100 text-sky-500"><Thermometer className="size-4" /></span>
              </div>
              <Readout value={avgTemp == null ? '—' : avgTemp.toFixed(1)} unit="°C" className="mt-3" />
              <p className="mt-1 text-xs text-muted">avg across outlets · {avgHum?.toFixed(0)} %RH</p>
              <div className="mt-3 h-12" role="img" aria-label={`Average temperature trend across outlets. Current average ${avgTemp == null ? 'unavailable' : `${avgTemp.toFixed(1)} degrees Celsius`}.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#83B3EE" stopOpacity={0.6} /><stop offset="100%" stopColor="#83B3EE" stopOpacity={0} /></linearGradient></defs>
                    <Area type="monotone" dataKey="v" stroke="#3f86dc" strokeWidth={2} fill="url(#tg)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted">Devices online</p>
                <span className="flex size-9 items-center justify-center rounded-full bg-ink text-white"><Router className="size-4" /></span>
              </div>
              <Readout value={onlineDevices} unit={`/ ${devices.length}`} className="mt-3" />
              <p className="mt-1 text-xs text-muted">{devices.length - onlineDevices} offline · push every 5 min</p>
              <div className="mt-4 flex gap-1">
                {devices.slice(0, 24).map((d) => <span key={d.id} className={cn('h-6 flex-1 rounded-full', d.status === 'online' ? 'bg-ink' : 'bg-brand-600')} title={d.serial} />)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <MaintenanceSummary />

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0 [&>*]:min-w-[72%] [&>*]:snap-start sm:[&>*]:min-w-0">
        <StatCard label="Avg response time" value={avg == null ? '—' : humanizeShort(avg)} hint={PERIODS.find((p) => p.value === period)?.label} icon={<Clock />} tone="success" />
        <StatCard label="Alerts in period" value={stats.total} hint={`${stats.open} open · ${stats.solved} solved`} icon={<Radio />} tone="default" />
        <StatCard label="Pending registrations" value={pending} hint="employee phones awaiting approval" icon={<UserPlus />} tone={pending ? 'warning' : 'default'} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]">
        <AlertColumn title="Active alerts" alerts={open} tab="unacknowledged" />
        <AlertColumn title="Resolved alerts" alerts={solved} tab="resolved" />
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-lg">Analysis</CardTitle></CardHeader>
          <CardContent>
            <div className="relative h-52" role="img" aria-label={`${stats.open} open alerts and ${stats.solved} solved alerts in the selected period.`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={64} outerRadius={88} paddingAngle={3} cornerRadius={6} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                    {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <ChartTooltip formatter={(v: number, n: string) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold leading-none">{stats.total}</p>
                <p className="mt-1 text-xs text-muted">alerts</p>
              </div>
            </div>
            <ul className="mt-2 flex items-center justify-center gap-4 text-sm">
              {donut.map((d) => (
                <li key={d.name} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: d.color }} />{d.name} <span className="font-semibold">{d.value}</span></li>
              ))}
            </ul>
            <div className="mt-5">
              <p className="mb-1.5 text-sm text-muted">Date</p>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
