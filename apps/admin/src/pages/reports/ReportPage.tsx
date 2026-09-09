import * as React from 'react';
import { useSearchParams } from 'react-router';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import type { Alert } from '@monitoring/types';
import { ALERT_CATEGORY_LABEL, ALERT_STATUS_LABEL } from '@monitoring/types';
import { Badge, Button, Card, DataTable, FormField, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, type Column } from '@monitoring/ui';
import { FIXTURE_NOW_MS, downloadCsv, employeeById, fmtDateTime, humanizeShort, readingsBySensor, sensorsByOutlet, toCsv, toWallClockDate } from '@monitoring/fixtures';
import { outletById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';
import { AlertStatusBadge, CategoryBadge } from '../../components/badges';

const dayStr = (ms: number) => format(toWallClockDate(ms), 'yyyy-MM-dd');

export function ReportPage() {
  const { alerts, outlets } = useScoped();
  const [params, setParams] = useSearchParams();
  const tab: 'alerts' | 'readings' = params.get('tab') === 'readings' ? 'readings' : 'alerts';
  const from = params.get('from') ?? dayStr(FIXTURE_NOW_MS - 29 * 86_400_000);
  const to = params.get('to') ?? dayStr(FIXTURE_NOW_MS);
  const outletFilter = outlets.some((o) => o.id === params.get('outlet')) ? params.get('outlet')! : 'all';
  const status = ['UNACKNOWLEDGED', 'ACKNOWLEDGED', 'RESPONDING', 'RESOLVED', 'VERIFIED'].includes(params.get('status') ?? '') ? params.get('status')! : 'all';
  const category = params.get('category') === 'COMFORT' || params.get('category') === 'SECURITY' ? params.get('category')! : 'all';
  const defaults = { from: dayStr(FIXTURE_NOW_MS - 29 * 86_400_000), to: dayStr(FIXTURE_NOW_MS) };
  const update = (patch: Record<string, string | null>) => { const next = new URLSearchParams(params); for (const [key, value] of Object.entries(patch)) value == null ? next.delete(key) : next.set(key, value); setParams(next, { replace: true }); };

  const inRange = (iso: string) => { const d = format(toWallClockDate(iso), 'yyyy-MM-dd'); return d >= from && d <= to; };
  const rows = React.useMemo(() => alerts.filter((a) => inRange(a.triggerTime) && (outletFilter === 'all' || a.outletId === outletFilter) && (status === 'all' || a.status === status) && (category === 'all' || a.category === category)), [alerts, from, to, outletFilter, status, category]);

  const readingRows = React.useMemo(() => {
    const ids = outlets.filter((o) => outletFilter === 'all' || o.id === outletFilter).flatMap((o) => (sensorsByOutlet.get(o.id) ?? []).filter((s) => s.type === 'TEMPERATURE_HUMIDITY'));
    return ids.flatMap((s) => (readingsBySensor.get(s.id) ?? []).filter((r) => inRange(r.at)).map((r) => ({ key: `${s.id}-${r.at}`, outlet: outletById.get(s.outletId)?.name ?? '', sensor: s.name, at: r.at, temp: r.temperatureC, hum: r.humidityPct, over: r.temperatureC > (s.thresholds?.max ?? 99) || r.humidityPct > (s.thresholds?.humidityMax ?? 100) }))).sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [outlets, outletFilter, from, to]);

  const exportAlerts = () => downloadCsv(`alert-history_${from}_${to}.csv`, toCsv(
    ['Alert ID', 'Triggered at', 'Cleared at', 'Outlet', 'Outlet code', 'Sensor', 'Category', 'Status', 'Trigger value', 'Clear value', 'Responded by', 'Response time (min)', 'Notes'],
    rows.map((a) => [a.id, a.triggerTime, a.clearTime, outletById.get(a.outletId)?.name, outletById.get(a.outletId)?.code, a.sensorName, ALERT_CATEGORY_LABEL[a.category], ALERT_STATUS_LABEL[a.status], a.triggerValue, a.clearValue, a.response ? employeeById.get(a.response.employeeId)?.name : '', a.response ? Math.round(a.response.responseDurationSec / 60) : '', a.response?.notes]),
  ));
  const exportReadings = () => downloadCsv(`temperature-log_${from}_${to}.csv`, toCsv(['Time', 'Outlet', 'Sensor', 'Temperature (°C)', 'Humidity (%RH)'], readingRows.map((r) => [r.at, r.outlet, r.sensor, r.temp, r.hum])));

  const alertColumns: Column<Alert>[] = [
    { key: 'id', header: 'ID', cell: (a) => <span className="font-mono text-xs">#{a.id}</span>, sortValue: (a) => a.id },
    { key: 'time', header: 'Triggered', cell: (a) => fmtDateTime(a.triggerTime), sortValue: (a) => a.triggerTime },
    { key: 'outlet', header: 'Outlet', cell: (a) => outletById.get(a.outletId)?.name, sortValue: (a) => outletById.get(a.outletId)?.name ?? '' },
    { key: 'sensor', header: 'Sensor', cell: (a) => <div><p className="font-medium">{a.message}</p><p className="text-xs text-muted">{a.sensorName}</p></div> },
    { key: 'cat', header: 'Category', cell: (a) => <CategoryBadge category={a.category} /> },
    { key: 'status', header: 'Status', cell: (a) => <AlertStatusBadge status={a.status} /> },
    { key: 'resp', header: 'Responded by', cell: (a) => (a.response ? <div><p>{employeeById.get(a.response.employeeId)?.name}</p><p className="text-xs text-muted">{humanizeShort(a.response.responseDurationSec)}</p></div> : <span className="text-muted">—</span>), sortValue: (a) => a.response?.responseDurationSec ?? 1e9 },
  ];
  type R = (typeof readingRows)[number];
  const readingColumns: Column<R>[] = [
    { key: 'at', header: 'Time', cell: (r) => fmtDateTime(r.at), sortValue: (r) => r.at },
    { key: 'outlet', header: 'Outlet', cell: (r) => r.outlet, sortValue: (r) => r.outlet },
    { key: 'sensor', header: 'Sensor', cell: (r) => r.sensor },
    { key: 'temp', header: 'Temperature', cell: (r) => <span className={r.over ? 'font-semibold text-brand-600' : ''}>{r.temp.toFixed(2)} °C</span>, sortValue: (r) => r.temp },
    { key: 'hum', header: 'Humidity', cell: (r) => `${r.hum.toFixed(1)} %RH`, sortValue: (r) => r.hum },
    { key: 'flag', header: '', cell: (r) => (r.over ? <Badge variant="brand">Out of range</Badge> : null) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Report" description="Alert history and temperature trend log, exportable to CSV" actions={
        <Button onClick={tab === 'alerts' ? exportAlerts : exportReadings}><Download />Export CSV ({tab === 'alerts' ? rows.length : readingRows.length})</Button>
      } />
      <Card>
        <div className="grid gap-4 p-5 md:grid-cols-5">
          <FormField label="From" htmlFor="from"><Input id="from" type="date" value={from} max={to} onChange={(e) => update({ from: e.target.value === defaults.from ? null : e.target.value })} /></FormField>
          <FormField label="To" htmlFor="to"><Input id="to" type="date" value={to} min={from} onChange={(e) => update({ to: e.target.value === defaults.to ? null : e.target.value })} /></FormField>
          <FormField label="Outlet"><Select value={outletFilter} onValueChange={(v) => update({ outlet: v === 'all' ? null : v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All outlets</SelectItem>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Status"><Select value={status} onValueChange={(v) => update({ status: v === 'all' ? null : v })} disabled={tab !== 'alerts'}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="UNACKNOWLEDGED">Unacknowledged</SelectItem><SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem><SelectItem value="RESPONDING">Responding</SelectItem><SelectItem value="RESOLVED">Resolved</SelectItem><SelectItem value="VERIFIED">Verified</SelectItem></SelectContent></Select></FormField>
          <FormField label="Category"><Select value={category} onValueChange={(v) => update({ category: v === 'all' ? null : v })} disabled={tab !== 'alerts'}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="COMFORT">Shopping Comfort</SelectItem><SelectItem value="SECURITY">Outlet Security</SelectItem></SelectContent></Select></FormField>
        </div>
      </Card>
      <Tabs value={tab} onValueChange={(v) => update({ tab: v === 'alerts' ? null : v })}>
        <TabsList variant="pill"><TabsTrigger value="alerts">Alert history</TabsTrigger><TabsTrigger value="readings">Temperature log</TabsTrigger></TabsList>
      </Tabs>
      <Card>
        {tab === 'alerts' ? <DataTable columns={alertColumns} rows={rows} rowKey={(a) => a.id} pageSize={15} initialSort={{ key: 'time', dir: 'desc' }} emptyTitle="No alerts in range" /> : <DataTable columns={readingColumns} rows={readingRows} rowKey={(r) => r.key} pageSize={15} emptyTitle="No readings in range" />}
      </Card>
    </div>
  );
}
