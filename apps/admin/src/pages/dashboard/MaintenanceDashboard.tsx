import * as React from 'react';
import { Link } from 'react-router';
import { Activity, AlertTriangle, ArrowUpRight, CalendarClock, Cpu, ShieldAlert, Wrench } from 'lucide-react';
import { MAINTENANCE_TYPE_LABEL } from '@monitoring/types';
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, Chip, EmptyState, Readout, StatCard, cn } from '@monitoring/ui';
import { nowMs, deviceHealth, fmtDate, fmtDateTime, fmtRelativeDay, isTicketOpen, isTicketOverdue, ticketCounts } from '@monitoring/fixtures';
import { outletById, technicianById, deviceTypeById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';
import { HealthBadge, PriorityBadge, TicketStatusBadge } from '../../components/badges';

const DAY = 86_400_000;

export function MaintenanceDashboard() {
  const { devices, tickets, technicians } = useScoped();
  const health = React.useMemo(() => devices.map((d) => ({ device: d, ...deviceHealth(d) })), [devices]);
  const healthy = health.filter((h) => h.status === 'healthy').length;
  const attention = health.filter((h) => h.status === 'attention').length;
  const critical = health.filter((h) => h.status === 'critical').length;
  const worst = [...health].sort((a, b) => ({ critical: 0, attention: 1, healthy: 2 })[a.status] - ({ critical: 0, attention: 1, healthy: 2 })[b.status] || b.issues.length - a.issues.length).slice(0, 3);
  const open = tickets.filter(isTicketOpen);
  const counts = ticketCounts(tickets);
  const overdue = open.filter(isTicketOverdue);
  const offline = devices.filter((d) => d.status === 'offline').length;
  const fwOutdated = devices.filter((d) => d.firmware !== deviceTypeById.get(d.deviceTypeId)?.latestFirmware).length;
  const overdueChecks = devices.filter((d) => Date.parse(d.nextMaintenanceAt) < nowMs()).length;
  const warrantySoon = devices.filter((d) => Date.parse(d.warrantyUntil) < nowMs() + 90 * DAY).length;
  const faults = devices.reduce((s, d) => s + d.sensorFaults, 0);
  const avgUptime = devices.length ? devices.reduce((s, d) => s + d.uptimePct, 0) / devices.length : 0;
  const upcoming = open.filter((t) => t.scheduledAt && Date.parse(t.scheduledAt) >= nowMs()).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  const next = upcoming[0];
  const nextTech = next?.technicianId ? technicianById.get(next.technicianId) : undefined;
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
  const topOpen = [...open].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.createdAt.localeCompare(b.createdAt)).slice(0, 5);
  const workload = technicians.map((t) => ({ tech: t, open: open.filter((x) => x.technicianId === t.id).length, overdue: overdue.filter((x) => x.technicianId === t.id).length }));
  const maxLoad = Math.max(1, ...workload.map((w) => w.open));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="relative flex flex-col overflow-hidden bg-ink text-white">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-600/30 blur-3xl" />
          <CardHeader className="relative flex-row items-start justify-between space-y-0">
            <div><p className="text-xs font-medium text-sidebar-muted">Maintenance overview</p><CardTitle className="text-2xl text-white">Fleet hardware health</CardTitle><p className="mt-1 text-xs text-sidebar-muted">{devices.length} AKCP unit{devices.length === 1 ? '' : 's'} across your outlets</p></div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold"><Activity className="size-3.5" />{avgUptime.toFixed(1)}% uptime</span>
          </CardHeader>
          <CardContent className="relative flex flex-1 flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
              <div>
                <p className="text-xs text-sidebar-muted">Healthy units</p>
                <div className="flex items-start gap-1 leading-none"><span className="text-6xl font-bold tracking-tight">{healthy}</span><span className="pt-2 text-lg font-semibold text-sidebar-muted">/ {devices.length}</span></div>
              </div>
              <div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="bg-emerald-400" style={{ width: `${(healthy / Math.max(1, devices.length)) * 100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(attention / Math.max(1, devices.length)) * 100}%` }} />
                  <div className="bg-brand-600" style={{ width: `${(critical / Math.max(1, devices.length)) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-sidebar-muted">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-400" />Healthy {healthy}</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />Attention {attention}</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand-600" />Critical {critical}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {worst.map((h) => (
                <Link key={h.device.id} to={`/devices/${h.device.id}`} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 transition-colors hover:bg-white/10">
                  <span className={cn('flex size-9 items-center justify-center rounded-full', h.status === 'critical' ? 'bg-brand-600' : h.status === 'attention' ? 'bg-amber-400 text-ink' : 'bg-emerald-400 text-ink')}><Cpu className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-mono text-xs font-semibold">{h.device.serial} <span className="font-sans font-normal text-sidebar-muted">· {outletById.get(h.device.outletId)?.name}</span></span><span className="block truncate text-xs text-sidebar-muted">{h.issues.map((i) => i.label).join(' · ') || 'No issues'}</span></span>
                  <ArrowUpRight className="size-4 text-sidebar-muted" />
                </Link>
              ))}
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Chip label={`${offline} offline`} className="border-white/10 bg-white/10 text-white hover:bg-white/20"><ShieldAlert /></Chip>
              <Chip label={`${fwOutdated} firmware outdated`} className="border-white/10 bg-white/10 text-white hover:bg-white/20"><Cpu /></Chip>
              <Chip label={`${overdueChecks} checks overdue`} className="border-white/10 bg-white/10 text-white hover:bg-white/20"><CalendarClock /></Chip>
              <Button asChild size="sm" className="ml-auto"><Link to="/devices/maintenance">Hardware health</Link></Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card className="col-span-2 bg-brand-600 text-white">
            <CardContent className="flex flex-col gap-5 p-5">
              <div className="flex items-start justify-between">
                <div><p className="text-sm font-medium text-white/80">Overdue tickets</p><p className="mt-1 text-5xl font-bold leading-none tracking-tight">{overdue.length}</p></div>
                <Button asChild variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20"><Link to="/devices/maintenance?view=tickets">Tickets<ArrowUpRight /></Link></Button>
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/80"><span>{counts.IN_PROGRESS} in progress · {counts.SCHEDULED} scheduled</span><span>{open.length} open total</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${open.length ? ((counts.IN_PROGRESS + counts.SCHEDULED) / open.length) * 100 : 0}%` }} /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between"><p className="text-sm font-medium text-muted">Open tickets</p><span className="flex size-9 items-center justify-center rounded-full bg-ink text-white"><Wrench className="size-4" /></span></div>
              <Readout value={open.length} unit={`/ ${tickets.length}`} className="mt-3" />
              <p className="mt-1 text-xs text-muted">{counts.OPEN} unscheduled · {counts.DONE} completed</p>
              <div className="mt-4 flex gap-1">{['OPEN', 'SCHEDULED', 'IN_PROGRESS'].map((s) => <span key={s} className={cn('h-6 rounded-full', s === 'OPEN' ? 'bg-brand-600' : s === 'SCHEDULED' ? 'bg-sky-300' : 'bg-amber-400')} style={{ flex: Math.max(0.15, counts[s as 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS']) }} />)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between"><p className="text-sm font-medium text-muted">Next site visit</p><span className="flex size-9 items-center justify-center rounded-full bg-sky-100 text-sky-500"><CalendarClock className="size-4" /></span></div>
              {next ? (
                <>
                  <p className="mt-3 text-2xl font-bold leading-tight">{fmtDate(next.scheduledAt!)}</p>
                  <p className="mt-1 truncate text-xs text-muted">{next.title} · {outletById.get(next.outletId)?.name}</p>
                  <div className="mt-3 flex items-center gap-2">{nextTech ? <><Avatar name={nextTech.name} color={nextTech.avatarColor} size="sm" /><span className="text-xs font-medium">{nextTech.name}</span></> : <Badge variant="outline">Unassigned</Badge>}</div>
                </>
              ) : <p className="mt-3 text-sm text-muted">No upcoming visits</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Critical hardware" value={critical} hint="offline or sensor fault" icon={<ShieldAlert />} tone="danger" />
        <StatCard label="Sensor faults" value={faults} hint="replacement tickets raised" icon={<AlertTriangle />} tone="warning" />
        <StatCard label="Firmware outdated" value={fwOutdated} hint={`of ${devices.length} units`} icon={<Cpu />} />
        <StatCard label="Warranty ending" value={warrantySoon} hint="within 90 days" icon={<CalendarClock />} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="text-lg">Priority tickets</CardTitle><Button asChild variant="outline" size="sm"><Link to="/devices/maintenance?view=tickets">View all<ArrowUpRight /></Link></Button></CardHeader>
          <CardContent className="space-y-2">
            {topOpen.length === 0 ? <EmptyState title="No open tickets" className="py-8" /> : topOpen.map((t) => (
              <Link key={t.id} to={`/devices/maintenance?view=tickets&ticket=${t.id}`} className="group flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-white hover:shadow-card">
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', t.priority === 'CRITICAL' ? 'bg-brand-600 text-white' : 'bg-ink text-white')}><Wrench className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.title}</span><span className="block truncate text-xs text-muted">{outletById.get(t.outletId)?.name} · {MAINTENANCE_TYPE_LABEL[t.type]}</span></span>
                <span className="flex shrink-0 flex-col items-end gap-1"><PriorityBadge priority={t.priority} /><span className="text-[11px] text-muted">{fmtRelativeDay(t.createdAt)}</span></span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="text-lg">Upcoming schedule</CardTitle><Button asChild variant="outline" size="sm"><Link to="/devices/maintenance?view=schedule">Calendar<ArrowUpRight /></Link></Button></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? <EmptyState title="Nothing scheduled" className="py-8" /> : upcoming.slice(0, 5).map((t) => { const tech = t.technicianId ? technicianById.get(t.technicianId) : undefined; return (
              <Link key={t.id} to={`/devices/maintenance?view=schedule&ticket=${t.id}`} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-white hover:shadow-card">
                <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-white py-1.5 shadow-card"><span className="text-[10px] font-semibold uppercase text-muted">{fmtDateTime(t.scheduledAt!).slice(0, 3)}</span><span className="text-lg font-bold leading-none">{fmtDateTime(t.scheduledAt!).slice(4, 6)}</span></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.title}</span><span className="block truncate text-xs text-muted">{outletById.get(t.outletId)?.name}</span></span>
                {tech ? <Avatar name={tech.name} color={tech.avatarColor} size="sm" /> : <TicketStatusBadge status={t.status} />}
              </Link>
            ); })}
          </CardContent>
        </Card>
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Technician workload</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {workload.map((w) => (
              <div key={w.tech.id}>
                <div className="flex items-center gap-2"><Avatar name={w.tech.name} color={w.tech.avatarColor} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{w.tech.name}</p><p className="truncate text-[11px] text-muted">{w.tech.specialty}</p></div><span className="text-sm font-bold">{w.open}</span></div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface"><div className="bg-ink" style={{ width: `${((w.open - w.overdue) / maxLoad) * 100}%` }} /><div className="bg-brand-600" style={{ width: `${(w.overdue / maxLoad) * 100}%` }} /></div>
              </div>
            ))}
            <p className="text-[11px] text-muted"><span className="mr-2 inline-block size-2 rounded-full bg-ink" />open <span className="ml-3 mr-2 inline-block size-2 rounded-full bg-brand-600" />overdue</p>
            <div className="flex flex-wrap gap-1.5 pt-1">{health.filter((h) => h.status !== 'healthy').slice(0, 6).map((h) => <Link key={h.device.id} to={`/devices/${h.device.id}`}><HealthBadge status={h.status} /></Link>)}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
