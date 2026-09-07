import * as React from 'react';
import { Avatar, EmptyState, cn } from '@monitoring/ui';
import { BellOff } from 'lucide-react';
import { useAuth } from '../auth/auth';
import { useMobileScope, useReadAlerts } from '../state/app-state';
import { AlertCard } from '../components/AlertCard';
import { LoadMore, useInfiniteList } from '../components/useInfiniteList';

export function AlertsPage() {
  const { user: employee } = useAuth();
  const { outlets, alerts } = useMobileScope(employee?.outletIds ?? []);
  const { read } = useReadAlerts();
  const [outletId, setOutletId] = React.useState('all');
  const list = outletId === 'all' ? alerts : alerts.filter((a) => a.outletId === outletId);
  const open = list.filter((a) => a.status === 'TRIGGERED');
  const responded = list.filter((a) => a.status === 'RESPONDED');
  const clearedAll = list.filter((a) => a.status === 'CLEARED');
  const openList = useInfiniteList(open, 8);
  const respondedList = useInfiniteList(responded, 8);
  const clearedList = useInfiniteList(clearedAll, 10);
  const firstName = employee?.name.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pt-3">
        <div>
          <p className="text-sm text-muted">{employee?.kind === 'technician' ? 'Technician · all outlets' : 'Good afternoon'}</p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">Welcome, {firstName}<span className="text-brand-600">.</span></h1>
        </div>
        <Avatar name={employee?.name ?? ''} color={employee?.avatarColor} size="lg" className="size-12 shadow-card ring-4 ring-white" />
      </header>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {[{ id: 'all', name: 'All Outlets' }, ...outlets].map((o) => (
          <button key={o.id} type="button" onClick={() => setOutletId(o.id)} className={cn('h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors', outletId === o.id ? 'bg-ink text-white' : 'bg-white text-body shadow-card')}>{o.name.replace('Indomaret ', '')}</button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[24px] bg-brand-600 px-4 py-5 text-white shadow-card"><p className="text-[32px] font-bold leading-none">{open.length}</p><p className="mt-2 text-xs font-medium text-white/80">Open</p></div>
        <div className="rounded-[24px] bg-sky-300 px-4 py-5 text-ink shadow-card"><p className="text-[32px] font-bold leading-none">{responded.length}</p><p className="mt-2 text-xs font-medium text-ink/70">Responded</p></div>
        <div className="rounded-[24px] bg-white px-4 py-5 shadow-card"><p className="text-[32px] font-bold leading-none">{clearedAll.length}</p><p className="mt-2 text-xs font-medium text-muted">Cleared</p></div>
      </div>

      {list.length === 0 ? <EmptyState icon={<BellOff />} title="No alerts" description="Everything is normal at your outlets." /> : null}
      {open.length ? <Section title="Needs response" count={open.length}>{openList.visible.map((a) => <AlertCard key={a.id} alert={a} unread={!read.has(a.id)} />)}<LoadMore hasMore={openList.hasMore} onLoad={openList.loadMore} remaining={openList.remaining} /></Section> : null}
      {responded.length ? <Section title="Responded" count={responded.length}>{respondedList.visible.map((a) => <AlertCard key={a.id} alert={a} />)}<LoadMore hasMore={respondedList.hasMore} onLoad={respondedList.loadMore} remaining={respondedList.remaining} /></Section> : null}
      {clearedAll.length ? <Section title="Cleared" count={clearedAll.length}>{clearedList.visible.map((a) => <AlertCard key={a.id} alert={a} />)}<LoadMore hasMore={clearedList.hasMore} onLoad={clearedList.loadMore} remaining={clearedList.remaining} /></Section> : null}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-base font-bold">{title}</h2>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-muted shadow-card">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
