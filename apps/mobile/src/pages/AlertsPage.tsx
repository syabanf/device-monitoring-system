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
  const [tab, setTab] = React.useState<'open' | 'responded' | 'cleared'>('open');
  const current = tab === 'open' ? open : tab === 'responded' ? responded : clearedAll;
  const paged = useInfiniteList(current, 6, `${tab}:${outletId}`);
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


      <section>
        <div className="mb-3 flex gap-1 rounded-full bg-white p-1 shadow-card">
          {([['open', 'Open', open.length], ['responded', 'Responded', responded.length], ['cleared', 'Cleared', clearedAll.length]] as const).map(([k, label, n]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn('flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors', tab === k ? (k === 'open' ? 'bg-brand-600 text-white' : 'bg-ink text-white') : 'text-muted')}>{label}<span className={cn('rounded-full px-1.5 text-[10px]', tab === k ? 'bg-white/20' : 'bg-surface')}>{n}</span></button>
          ))}
        </div>
        {current.length === 0 ? <EmptyState icon={<BellOff />} title="Nothing here" description={tab === 'open' ? 'Everything is normal at your outlets.' : 'No alerts in this list.'} /> : (
          <div className="space-y-3">
            {paged.visible.map((a) => <AlertCard key={a.id} alert={a} unread={tab === 'open' && !read.has(a.id)} />)}
            <LoadMore hasMore={paged.hasMore} onLoad={paged.loadMore} remaining={paged.remaining} />
          </div>
        )}
      </section>
    </div>
  );
}

