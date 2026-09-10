import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertTriangle, CalendarClock, Cpu, Pencil, Plus, ShieldAlert, Trash2, UserPlus, Wrench } from 'lucide-react';
import type { Technician } from '@monitoring/types';
import type { Device, MaintenanceTicket, TicketStatus } from '@monitoring/types';
import { MAINTENANCE_TYPE_LABEL } from '@monitoring/types';
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Tabs, TabsList, TabsTrigger, cn, type Column } from '@monitoring/ui';
import { FIXTURE_NOW_MS, deviceHealth, fmtDate, fmtDateTime, fmtRelativeDay, isTicketOpen, isTicketOverdue, ticketCounts } from '@monitoring/fixtures';
import { outletById, technicianById, deviceTypeById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';
import { DeviceStatusBadge, HealthBadge, PriorityBadge, TicketStatusBadge } from '../../components/badges';
import { TicketSheet } from './TicketSheet';
import { NewTicketDialog } from './NewTicketDialog';
import { TechnicianDialog, emptyTechnician } from '../../components/master/TechnicianDialog';
import { ConfirmDelete } from '../../components/master/ConfirmDelete';

type View = 'health' | 'tickets' | 'schedule' | 'technicians';

export function MaintenancePage() {
  const { devices, tickets, technicians, distributorId, dispatch } = useScoped();
  const [techEdit, setTechEdit] = React.useState<Technician | null>(null);
  const [techRemove, setTechRemove] = React.useState<Technician | null>(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = (['health', 'tickets', 'schedule', 'technicians'].includes(params.get('view') ?? '') ? params.get('view') : 'health') as View;
  const status = (['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'DONE'].includes(params.get('status') ?? '') ? params.get('status') : 'all') as 'all' | TicketStatus;
  const [creating, setCreating] = React.useState(false);
  const selected = tickets.find((t) => t.id === params.get('ticket')) ?? null;
  const update = (patch: Record<string, string | null>) => { const n = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) (v == null ? n.delete(k) : n.set(k, v)); setParams(n, { replace: true }); };

  const health = React.useMemo(() => devices.map((d) => ({ device: d, ...deviceHealth(d) })), [devices]);
  const critical = health.filter((h) => h.status === 'critical').length;
  const attention = health.filter((h) => h.status === 'attention').length;
  const counts = ticketCounts(tickets);
  const openTickets = tickets.filter(isTicketOpen);
  const warrantySoon = devices.filter((d) => Date.parse(d.warrantyUntil) < FIXTURE_NOW_MS + 90 * 86_400_000).length;

  const healthColumns: Column<(typeof health)[number]>[] = [
    { key: 'device', header: 'Device', cell: (h) => <div><p className="font-mono text-xs font-semibold">{h.device.serial}</p><p className="text-xs text-muted">{outletById.get(h.device.outletId)?.name}</p></div>, sortValue: (h) => h.device.serial },
    { key: 'health', header: 'Health', cell: (h) => <HealthBadge status={h.status} />, sortValue: (h) => ({ critical: 0, attention: 1, healthy: 2 })[h.status] },
    { key: 'issues', header: 'Issues', cell: (h) => (h.issues.length ? <ul className="space-y-0.5 text-xs">{h.issues.map((i) => <li key={i.code} className={cn('flex items-center gap-1.5', i.severity === 'critical' ? 'text-brand-600' : 'text-body')}><span className={cn('size-1.5 rounded-full', i.severity === 'critical' ? 'bg-brand-600' : 'bg-amber-500')} />{i.label}</li>)}</ul> : <span className="text-xs text-muted">No issues</span>) },
    { key: 'status', header: 'Connection', cell: (h) => <DeviceStatusBadge status={h.device.status} /> },
    { key: 'uptime', header: 'Uptime 30d', cell: (h) => <span className={cn('tabular-nums', h.device.uptimePct < 95 && 'text-brand-600')}>{h.device.uptimePct.toFixed(1)}%</span>, sortValue: (h) => h.device.uptimePct },
    { key: 'fw', header: 'Firmware', cell: (h) => { const latest = deviceTypeById.get(h.device.deviceTypeId)?.latestFirmware; return <span className={cn('font-mono text-xs', h.device.firmware !== latest && 'text-amber-600')}>{h.device.firmware}{h.device.firmware !== latest ? ` → ${latest}` : ''}</span>; } },
    { key: 'next', header: 'Next check', cell: (h) => <span className={cn(Date.parse(h.device.nextMaintenanceAt) < FIXTURE_NOW_MS && 'font-semibold text-brand-600')}>{fmtDate(h.device.nextMaintenanceAt)}</span>, sortValue: (h) => h.device.nextMaintenanceAt },
    { key: 'warranty', header: 'Warranty', cell: (h) => fmtDate(h.device.warrantyUntil), sortValue: (h) => h.device.warrantyUntil },
  ];

  const ticketRows = status === 'all' ? tickets : tickets.filter((t) => t.status === status);
  const ticketColumns: Column<MaintenanceTicket>[] = [
    { key: 'id', header: 'Ticket', cell: (t) => <div><p className="font-medium">{t.title}</p><p className="text-xs text-muted">{t.id} · {MAINTENANCE_TYPE_LABEL[t.type]}</p></div>, sortValue: (t) => t.id },
    { key: 'device', header: 'Device / Outlet', cell: (t) => <div><p className="font-mono text-xs">{(devices.find((d) => d.id === t.deviceId) as Device | undefined)?.serial}</p><p className="text-xs text-muted">{outletById.get(t.outletId)?.name}</p></div> },
    { key: 'priority', header: 'Priority', cell: (t) => <PriorityBadge priority={t.priority} />, sortValue: (t) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 })[t.priority] },
    { key: 'status', header: 'Status', cell: (t) => <div className="flex items-center gap-1.5"><TicketStatusBadge status={t.status} />{isTicketOverdue(t) ? <Badge variant="brand">Overdue</Badge> : null}</div>, sortValue: (t) => t.status },
    { key: 'tech', header: 'Technician', cell: (t) => { const tech = t.technicianId ? technicianById.get(t.technicianId) : undefined; return tech ? <div className="flex items-center gap-2"><Avatar name={tech.name} color={tech.avatarColor} size="sm" /><span className="text-sm">{tech.name}</span></div> : <span className="text-xs text-muted">Unassigned</span>; } },
    { key: 'sched', header: 'Scheduled', cell: (t) => (t.scheduledAt ? fmtDateTime(t.scheduledAt) : <span className="text-muted">—</span>), sortValue: (t) => t.scheduledAt ?? '9' },
    { key: 'created', header: 'Created', cell: (t) => fmtRelativeDay(t.createdAt), sortValue: (t) => t.createdAt },
  ];

  const schedule = React.useMemo(() => openTickets.filter((t) => t.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!)), [openTickets]);
  const scheduleByDay = React.useMemo(() => { const m = new Map<string, MaintenanceTicket[]>(); for (const t of schedule) { const k = fmtDate(t.scheduledAt!); m.set(k, [...(m.get(k) ?? []), t]); } return [...m.entries()]; }, [schedule]);

  return (
    <div className="space-y-4">
      <PageHeader title="Device Maintenance" description="Hardware health, service tickets and the technician schedule for every Room Alert unit" actions={<Button onClick={() => setCreating(true)}><Plus />New ticket</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Critical hardware" value={critical} hint={`${attention} more need attention`} icon={<ShieldAlert />} tone="danger" />
        <StatCard label="Open tickets" value={openTickets.length} hint={`${counts.overdue} overdue · ${counts.IN_PROGRESS} in progress`} icon={<Wrench />} tone="warning" />
        <StatCard label="Scheduled visits" value={counts.SCHEDULED} hint="next 30 days" icon={<CalendarClock />} tone="default" />
        <StatCard label="Warranty ending" value={warrantySoon} hint="within 90 days" icon={<Cpu />} tone="success" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => update({ view: v })}>
          <TabsList variant="pill">
            <TabsTrigger value="health">Hardware health</TabsTrigger>
            <TabsTrigger value="tickets">Tickets ({openTickets.length})</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="technicians">Technicians</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === 'technicians' ? <Button variant="outline" onClick={() => setTechEdit(emptyTechnician(distributorId))}><UserPlus />Add technician</Button> : null}
        {view === 'tickets' ? (
          <Select value={status} onValueChange={(v) => update({ status: v === 'all' ? null : v })}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="OPEN">Open</SelectItem><SelectItem value="SCHEDULED">Scheduled</SelectItem><SelectItem value="IN_PROGRESS">In progress</SelectItem><SelectItem value="DONE">Done</SelectItem></SelectContent>
          </Select>
        ) : null}
      </div>

      {view === 'health' ? <Card><DataTable columns={healthColumns} rows={health} rowKey={(h) => h.device.id} onRowClick={(h) => navigate(`/devices/${h.device.id}`)} pageSize={12} initialSort={{ key: 'health', dir: 'asc' }} /></Card> : null}
      {view === 'tickets' ? <Card><DataTable columns={ticketColumns} rows={ticketRows} rowKey={(t) => t.id} onRowClick={(t) => update({ ticket: t.id })} pageSize={12} initialSort={{ key: 'priority', dir: 'asc' }} emptyTitle="No tickets" /></Card> : null}
      {view === 'schedule' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {scheduleByDay.length === 0 ? <Card><EmptyState title="Nothing scheduled" /></Card> : scheduleByDay.map(([day, list]) => (
            <Card key={day}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-muted" />{day}</CardTitle><Badge variant="default">{list.length} visit{list.length > 1 ? 's' : ''}</Badge></CardHeader>
              <CardContent className="space-y-2">
                {list.map((t) => { const tech = t.technicianId ? technicianById.get(t.technicianId) : undefined; const overdue = isTicketOverdue(t); return (
                  <button key={t.id} type="button" onClick={() => update({ ticket: t.id })} className={cn('flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white hover:shadow-card', overdue ? 'bg-brand-50' : 'bg-surface-2')}>
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', overdue ? 'bg-brand-600 text-white' : 'bg-ink text-white')}>{overdue ? <AlertTriangle className="size-4" /> : <Wrench className="size-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.title}</span><span className="block truncate text-xs text-muted">{outletById.get(t.outletId)?.name} · {fmtDateTime(t.scheduledAt!).slice(-9)}</span></span>
                    {tech ? <Avatar name={tech.name} color={tech.avatarColor} size="sm" /> : <Badge variant="outline">Unassigned</Badge>}
                  </button>
                ); })}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {view === 'technicians' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {technicians.map((tech) => { const mine = openTickets.filter((t) => t.technicianId === tech.id); const done = tickets.filter((t) => t.technicianId === tech.id && t.status === 'DONE').length; return (
            <Card key={tech.id}>
              <CardHeader className="flex-row items-center gap-3 space-y-0"><Avatar name={tech.name} color={tech.avatarColor} size="lg" /><div className="min-w-0 flex-1"><CardTitle>{tech.name}</CardTitle><p className="truncate text-xs text-muted">{tech.specialty} · {tech.phone}</p><p className="truncate text-xs text-muted">{tech.email}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" className="size-8" aria-label="Edit" onClick={() => setTechEdit(tech)}><Pencil /></Button><Button variant="ghost" size="icon" className="size-8 text-brand-600" aria-label="Delete" onClick={() => setTechRemove(tech)}><Trash2 /></Button></div></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-surface p-3"><p className="text-2xl font-bold">{mine.length}</p><p className="text-[11px] text-muted">open</p></div>
                  <div className="rounded-2xl bg-surface p-3"><p className="text-2xl font-bold">{mine.filter(isTicketOverdue).length}</p><p className="text-[11px] text-muted">overdue</p></div>
                  <div className="rounded-2xl bg-surface p-3"><p className="text-2xl font-bold">{done}</p><p className="text-[11px] text-muted">done</p></div>
                </div>
                <div className="mt-3 space-y-1.5">{mine.slice(0, 3).map((t) => <button key={t.id} type="button" onClick={() => update({ ticket: t.id })} className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-xs hover:bg-surface"><span className="truncate">{t.title}</span><TicketStatusBadge status={t.status} /></button>)}</div>
              </CardContent>
            </Card>
          ); })}
        </div>
      ) : null}

      <TicketSheet ticket={selected} onClose={() => update({ ticket: null })} />
      <NewTicketDialog open={creating} onClose={() => setCreating(false)} />
      <TechnicianDialog technician={techEdit} onClose={() => setTechEdit(null)} />
      <ConfirmDelete open={!!techRemove} title={`Delete ${techRemove?.name}?`} description="Their open tickets become unassigned." onCancel={() => setTechRemove(null)} onConfirm={() => { if (techRemove) dispatch({ type: 'technicians/remove', technicianId: techRemove.id }); setTechRemove(null); }} />
    </div>
  );
}
