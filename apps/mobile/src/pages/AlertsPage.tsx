import { useSearchParams } from 'react-router';
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
  const [params, setParams] = useSearchParams();
  const requestedOutlet = params.get('outlet') ?? 'all';
  const outletId = requestedOutlet === 'all' || outlets.some((o) => o.id === requestedOutlet) ? requestedOutlet : 'all';
  const list = outletId === 'all' ? alerts : alerts.filter((a) => a.outletId === outletId);
  const groups = {
    unacknowledged: list.filter((a) => a.status === 'UNACKNOWLEDGED'),
    acknowledged: list.filter((a) => a.status === 'ACKNOWLEDGED'),
    responding: list.filter((a) => a.status === 'RESPONDING'),
    resolved: list.filter((a) => a.status === 'RESOLVED'),
    verified: list.filter((a) => a.status === 'VERIFIED'),
  };
  const requestedTab = params.get('tab');
  type Tab = keyof typeof groups;
  const tab: Tab = requestedTab && requestedTab in groups ? requestedTab as Tab : 'unacknowledged';
  const update = (patch: Record<string, string>) => { const next = new URLSearchParams(params); for (const [key, value] of Object.entries(patch)) value === 'all' || (key === 'tab' && value === 'unacknowledged') ? next.delete(key) : next.set(key, value); setParams(next, { replace: true }); };
  const current = groups[tab];
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
          <button key={o.id} type="button" aria-pressed={outletId === o.id} onClick={() => update({ outlet: o.id })} className={cn('h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors', outletId === o.id ? 'bg-ink text-white' : 'bg-white text-body shadow-card')}>{o.name.replace('Indomaret ', '')}</button>
        ))}
      </div>


      <section>
        <div className="-mx-5 mb-3 flex gap-1 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {([['unacknowledged', 'New', groups.unacknowledged.length], ['acknowledged', 'Acknowledged', groups.acknowledged.length], ['responding', 'Responding', groups.responding.length], ['resolved', 'Resolved', groups.resolved.length], ['verified', 'Verified', groups.verified.length]] as const).map(([k, label, n]) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => update({ tab: k })} className={cn('flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors', tab === k ? (k === 'unacknowledged' ? 'bg-brand-600 text-white' : 'bg-ink text-white') : 'bg-white text-muted shadow-card')}>{label}<span className={cn('rounded-full px-1.5 text-[10px]', tab === k ? 'bg-white/20' : 'bg-surface')}>{n}</span></button>
          ))}
        </div>
        {current.length === 0 ? <EmptyState icon={<BellOff />} title="Nothing here" description={tab === 'unacknowledged' ? 'No new alerts need acknowledgement.' : 'No alerts in this stage.'} /> : (
          <div className="space-y-3">
            {paged.visible.map((a) => <AlertCard key={a.id} alert={a} unread={tab === 'unacknowledged' && !read.has(a.id)} />)}
            <LoadMore hasMore={paged.hasMore} onLoad={paged.loadMore} remaining={paged.remaining} />
          </div>
        )}
      </section>
    </div>
  );
}
