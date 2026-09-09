import * as React from 'react';
import { useSearchParams } from 'react-router';
import type { Alert } from '@monitoring/types';
import { Badge, Card, DataTable, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, type Column } from '@monitoring/ui';
import { fmtDateTime, humanizeShort, ongoingSeconds } from '@monitoring/fixtures';
import { outletById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';
import { AlertStatusBadge, CategoryBadge, SensorIcon } from '../../components/badges';
import { AlertDetailDrawer } from './AlertDetailDrawer';

const TABS = [
  { value: 'unacknowledged', label: 'Unacknowledged', status: 'UNACKNOWLEDGED' },
  { value: 'acknowledged', label: 'Acknowledged', status: 'ACKNOWLEDGED' },
  { value: 'responding', label: 'Responding', status: 'RESPONDING' },
  { value: 'resolved', label: 'Resolved', status: 'RESOLVED' },
  { value: 'verified', label: 'Verified', status: 'VERIFIED' },
] as const;

export function AlertsPage() {
  const { alerts, outlets } = useScoped();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.value === params.get('tab'))?.value ?? 'unacknowledged';
  const selectedId = Number(params.get('id'));
  const outletFilter = outlets.some((o) => o.id === params.get('outlet')) ? params.get('outlet')! : 'all';
  const category = (params.get('category') === 'COMFORT' || params.get('category') === 'SECURITY' ? params.get('category') : 'all') as 'all' | 'COMFORT' | 'SECURITY';

  const status = TABS.find((t) => t.value === tab)!.status;
  const rows = React.useMemo(() => alerts.filter((a) => a.status === status && (outletFilter === 'all' || a.outletId === outletFilter) && (category === 'all' || a.category === category)), [alerts, status, outletFilter, category]);
  const selected = alerts.find((a) => a.id === selectedId) ?? null;
  const counts = Object.fromEntries(TABS.map((item) => [item.value, alerts.filter((alert) => alert.status === item.status).length])) as Record<(typeof TABS)[number]['value'], number>;

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v == null ? next.delete(k) : next.set(k, v));
    setParams(next, { replace: true });
  };

  const columns: Column<Alert>[] = [
    { key: 'id', header: 'ID', cell: (a) => <span className="font-mono text-xs">#{a.id}</span>, sortValue: (a) => a.id },
    { key: 'time', header: 'Triggered', cell: (a) => fmtDateTime(a.triggerTime), sortValue: (a) => a.triggerTime },
    { key: 'alert', header: 'Alert', cell: (a) => <div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-full bg-surface"><SensorIcon type={a.sensorType} /></span><div><p className="font-medium">{a.message}</p><p className="text-xs text-muted">{a.sensorName}</p></div></div> },
    { key: 'outlet', header: 'Outlet', cell: (a) => outletById.get(a.outletId)?.name ?? '—', sortValue: (a) => outletById.get(a.outletId)?.name ?? '' },
    { key: 'category', header: 'Category', cell: (a) => <CategoryBadge category={a.category} /> },
    { key: 'value', header: 'Value', cell: (a) => <span className="font-semibold">{a.triggerValue}</span> },
    { key: 'duration', header: status === 'RESOLVED' || status === 'VERIFIED' ? 'Duration' : 'Ongoing', cell: (a) => <Badge variant={status === 'RESOLVED' || status === 'VERIFIED' ? 'default' : 'warning'}>{humanizeShort(ongoingSeconds(a.triggerTime, a.clearTime))}</Badge>, sortValue: (a) => ongoingSeconds(a.triggerTime, a.clearTime) },
    { key: 'status', header: 'Status', cell: (a) => <AlertStatusBadge status={a.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Notification list, respond list and history from every Room Alert in this distribution center"
        actions={
          <>
            <Select value={category} onValueChange={(v) => update({ category: v === 'all' ? null : v })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem><SelectItem value="COMFORT">Shopping Comfort</SelectItem><SelectItem value="SECURITY">Outlet Security</SelectItem></SelectContent>
            </Select>
            <Select value={outletFilter} onValueChange={(v) => update({ outlet: v === 'all' ? null : v })}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All outlets</SelectItem>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => update({ tab: v, id: null })} className="mb-4">
        <TabsList variant="pill">{TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label} <span className="ml-1 opacity-70">{counts[t.value]}</span></TabsTrigger>)}</TabsList>
      </Tabs>
      <Card><DataTable columns={columns} rows={rows} rowKey={(a) => a.id} onRowClick={(a) => update({ id: String(a.id) })} pageSize={15} initialSort={{ key: 'time', dir: 'desc' }} emptyTitle="No alerts in this list" /></Card>
      <AlertDetailDrawer alert={selected} onClose={() => update({ id: null })} />
    </div>
  );
}
