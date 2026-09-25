import * as React from 'react';
import { Link } from 'react-router';
import { ChevronRight, Cpu, Plus, Wrench } from 'lucide-react';
import { HEALTH_LABEL } from '@monitoring/types';
import { Avatar, Button, EmptyState, cn } from '@monitoring/ui';
import { deviceHealth, isTicketOpen, isTicketOverdue } from '@monitoring/fixtures';
import { outletById } from '../state/lookups';
import { useAuth } from '../auth/auth';
import { useMobileScope } from '../state/app-state';
import { TicketCard } from '../components/TicketCard';
import { LoadMore, useInfiniteList } from '../components/useInfiniteList';

type Filter = 'mine' | 'open' | 'done';

export function MaintenancePage() {
  const { user } = useAuth();
  const { tickets, devices } = useMobileScope(user?.outletIds ?? []);
  const isTech = user?.kind === 'technician';
  const [filter, setFilter] = React.useState<Filter>(isTech ? 'mine' : 'open');
  const health = React.useMemo(() => devices.map((d) => ({ device: d, ...deviceHealth(d) })).sort((a, b) => ({ critical: 0, attention: 1, healthy: 2 })[a.status] - ({ critical: 0, attention: 1, healthy: 2 })[b.status]), [devices]);
  const open = tickets.filter(isTicketOpen);
  const mine = isTech ? open.filter((t) => t.technicianId === user!.id) : open;
  const overdue = mine.filter(isTicketOverdue);
  const list = filter === 'done' ? tickets.filter((t) => t.status === 'DONE') : filter === 'mine' ? mine : open;
  const critical = health.filter((h) => h.status === 'critical').length;
  const paged = useInfiniteList(list, 6, filter);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pt-3">
        <div>
          <p className="text-sm text-muted">{isTech ? `${user?.technician?.specialty}` : 'Device maintenance'}</p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">Maintenance<span className="text-brand-600">.</span></h1>
        </div>
        <Avatar name={user?.name ?? ''} color={user?.avatarColor} size="lg" className="size-12 shadow-card ring-4 ring-white" />
      </header>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[24px] bg-ink px-4 py-5 text-white shadow-card"><p className="text-[32px] font-bold leading-none">{mine.length}</p><p className="mt-2 text-xs font-medium text-white/70">{isTech ? 'My tickets' : 'Open tickets'}</p></div>
        <div className="rounded-[24px] bg-brand-600 px-4 py-5 text-white shadow-card"><p className="text-[32px] font-bold leading-none">{overdue.length}</p><p className="mt-2 text-xs font-medium text-white/80">Overdue</p></div>
        <div className="rounded-[24px] bg-white px-4 py-5 shadow-card"><p className="text-[32px] font-bold leading-none">{critical}</p><p className="mt-2 text-xs font-medium text-muted">Critical units</p></div>
      </div>

      {!isTech ? (
        <Button asChild size="lg" className="w-full"><Link to="/maintenance/new"><Plus />Report a hardware issue</Link></Button>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-base font-bold">Hardware health</h2><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-muted shadow-card">{devices.length} units</span></div>
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {health.map((h) => (
            <Link key={h.device.id} to={`/devices?outlet=${h.device.outletId}`} className={cn('w-44 shrink-0 rounded-[22px] p-4 shadow-card', h.status === 'critical' ? 'bg-brand-600 text-white' : h.status === 'attention' ? 'bg-amber-100' : 'bg-white')}>
              <div className="flex items-center justify-between"><span className={cn('flex size-9 items-center justify-center rounded-xl', h.status === 'critical' ? 'bg-white/20' : 'bg-surface')}><Cpu className="size-4" /></span><span className={cn('text-[10px] font-bold uppercase tracking-wide', h.status === 'critical' ? 'text-white/80' : h.status === 'attention' ? 'text-amber-700' : 'text-emerald-600')}>{HEALTH_LABEL[h.status]}</span></div>
              <p className="mt-4 truncate text-sm font-bold">{outletById.get(h.device.outletId)?.name?.replace('Indomaret ', '')}</p>
              <p className={cn('truncate font-mono text-[10px]', h.status === 'critical' ? 'text-white/70' : 'text-muted')}>{h.device.serial}</p>
              <p className={cn('mt-2 line-clamp-2 text-[11px]', h.status === 'critical' ? 'text-white/85' : 'text-body')}>{h.issues[0]?.label ?? 'No issues detected'}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-base font-bold">Tickets</h2>
          <div className="flex gap-1 rounded-full bg-white p-1 shadow-card">
            {([isTech ? ['mine', 'Mine'] : ['open', 'Open'], isTech ? ['open', 'All open'] : null, ['done', 'Done']] as ([Filter, string] | null)[]).filter((x): x is [Filter, string] => !!x).map(([f, l]) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={cn('h-8 rounded-full px-3 text-xs font-semibold', filter === f ? 'bg-ink text-white' : 'text-muted')}>{l}</button>
            ))}
          </div>
        </div>
        {list.length === 0 ? <EmptyState icon={<Wrench />} title="No tickets" description={isTech ? 'Nothing assigned to you right now.' : 'No maintenance tickets for your outlets.'} /> : <div className="space-y-3">{paged.visible.map((t) => <TicketCard key={t.id} ticket={t} />)}<LoadMore hasMore={paged.hasMore} onLoad={paged.loadMore} remaining={paged.remaining} /></div>}
      </section>

      {!isTech ? (
        <Link to="/devices" className="flex items-center gap-3 rounded-[24px] bg-sky-100 p-4"><span className="flex size-10 items-center justify-center rounded-full bg-white text-sky-500"><Cpu className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Where is everything installed?</span><span className="block text-xs text-body/70">Open the floor plan under Devices</span></span><ChevronRight className="size-4 text-body/50" /></Link>
      ) : null}
    </div>
  );
}
