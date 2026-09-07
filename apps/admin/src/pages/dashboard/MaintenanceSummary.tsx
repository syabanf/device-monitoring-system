import * as React from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, CalendarClock, Cpu, Wrench } from 'lucide-react';
import { Avatar, Button, Card, CardContent, cn } from '@monitoring/ui';
import { FIXTURE_NOW_MS, deviceHealth, fmtDate, isTicketOpen, isTicketOverdue } from '@monitoring/fixtures';
import { outletById, technicianById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';

/** Compact maintenance strip shown inside the Operations dashboard so hardware status is never out of sight. */
export function MaintenanceSummary() {
  const { devices, tickets } = useScoped();
  const health = React.useMemo(() => devices.map(deviceHealth), [devices]);
  const healthy = health.filter((h) => h.status === 'healthy').length;
  const attention = health.filter((h) => h.status === 'attention').length;
  const critical = health.filter((h) => h.status === 'critical').length;
  const open = tickets.filter(isTicketOpen);
  const overdue = open.filter(isTicketOverdue).length;
  const next = open.filter((t) => t.scheduledAt && Date.parse(t.scheduledAt) >= FIXTURE_NOW_MS).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];
  const tech = next?.technicianId ? technicianById.get(next.technicianId) : undefined;
  return (
    <Card>
      <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full bg-ink text-white"><Cpu className="size-4" /></span><p className="text-sm font-semibold">Hardware health</p><span className="text-xs text-muted">{devices.length} units</span></div>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface">
            <div className="bg-emerald-400" style={{ width: `${(healthy / Math.max(1, devices.length)) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(attention / Math.max(1, devices.length)) * 100}%` }} />
            <div className="bg-brand-600" style={{ width: `${(critical / Math.max(1, devices.length)) * 100}%` }} />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted"><span><b className="text-foreground">{healthy}</b> healthy</span><span><b className="text-foreground">{attention}</b> attention</span><span><b className={cn(critical && 'text-brand-600')}>{critical}</b> critical</span></div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('flex size-10 items-center justify-center rounded-full', overdue ? 'bg-brand-600 text-white' : 'bg-surface text-ink')}><Wrench className="size-4" /></span>
          <div><p className="text-2xl font-bold leading-none">{open.length}</p><p className="text-xs text-muted">open tickets · {overdue} overdue</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-sky-100 text-sky-500"><CalendarClock className="size-4" /></span>
          {next ? <div className="min-w-0"><p className="text-sm font-bold leading-tight">{fmtDate(next.scheduledAt!)}</p><p className="truncate text-xs text-muted">{outletById.get(next.outletId)?.name?.replace('Indomaret ', '')} · {tech ? tech.name.split(' ')[0] : 'unassigned'}</p></div> : <p className="text-xs text-muted">No visit scheduled</p>}
          {tech ? <Avatar name={tech.name} color={tech.avatarColor} size="sm" /> : null}
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/?view=maintenance">Maintenance view<ArrowUpRight /></Link></Button>
      </CardContent>
    </Card>
  );
}
