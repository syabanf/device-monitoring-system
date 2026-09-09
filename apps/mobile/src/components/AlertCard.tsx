import { Link } from 'react-router';
import type { Alert } from '@monitoring/types';
import { fmtRelativeDay, outletById } from '@monitoring/fixtures';
import { cn } from '@monitoring/ui';
import { CircleAlert, CircleCheck, Eye, LoaderCircle, ShieldCheck } from 'lucide-react';
import { SensorIcon } from './SensorIcon';

export function statusLabel(a: Alert) {
  return a.status === 'UNACKNOWLEDGED' ? 'Unacknowledged' : a.status === 'ACKNOWLEDGED' ? 'Acknowledged' : a.status === 'RESPONDING' ? 'Responding' : a.status === 'RESOLVED' ? 'Resolved' : 'Verified';
}
export function AlertCard({ alert, unread }: { alert: Alert; unread?: boolean }) {
  const outlet = outletById.get(alert.outletId);
  const actionable = alert.status === 'UNACKNOWLEDGED' || alert.status === 'ACKNOWLEDGED' || alert.status === 'RESPONDING';
  const StatusIcon = alert.status === 'UNACKNOWLEDGED' ? CircleAlert : alert.status === 'ACKNOWLEDGED' ? Eye : alert.status === 'RESPONDING' ? LoaderCircle : alert.status === 'RESOLVED' ? CircleCheck : ShieldCheck;
  return (
    <Link to={`/alerts/${alert.id}`} className={cn('block rounded-[24px] p-4 shadow-card transition-transform active:scale-[0.98]', actionable ? 'bg-white' : 'bg-white/70')}>
      <div className="flex items-center gap-3.5">
        <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full', alert.status === 'UNACKNOWLEDGED' ? 'bg-brand-600 text-white' : alert.status === 'ACKNOWLEDGED' ? 'bg-amber-100 text-amber-800' : alert.status === 'RESPONDING' ? 'bg-sky-100 text-sky-700' : 'bg-surface text-body')}>
          <SensorIcon type={alert.sensorType} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-foreground">{fmtRelativeDay(alert.triggerTime)}</span>
            <span className={cn('flex items-center gap-1.5 text-[11px] font-semibold', alert.status === 'UNACKNOWLEDGED' ? 'text-brand-600' : 'text-body')}>
              <StatusIcon aria-hidden="true" className={cn('size-3.5', alert.status === 'RESPONDING' && 'animate-spin motion-reduce:animate-none')} />{statusLabel(alert)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted">{outlet?.name?.replace('Indomaret ', 'IDM ')} · {alert.sensorName}</p>
        </div>
      </div>
      <p className="mt-3 text-[15px] font-semibold leading-snug text-foreground">{alert.message}</p>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-sm font-bold tabular-nums text-body">{alert.triggerValue}</span>
        {unread ? <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-600"><span className="size-2 rounded-full bg-brand-600" />New</span> : null}
      </div>
    </Link>
  );
}
