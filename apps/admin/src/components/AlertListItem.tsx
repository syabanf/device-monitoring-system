import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import type { Alert } from '@monitoring/types';
import { fmtRelativeDay } from '@monitoring/fixtures';
import { outletById } from '../state/lookups';
import { cn } from '@monitoring/ui';
import { AlertStatusBadge, SensorIcon } from './badges';

export function alertHref(alert: Alert) {
  const tab = alert.status === 'CLEARED' ? 'cleared' : alert.status === 'RESPONDED' ? 'responded' : 'open';
  return `/alerts?tab=${tab}&id=${alert.id}`;
}

export function AlertListItem({ alert, className, compact }: { alert: Alert; className?: string; compact?: boolean }) {
  const outlet = outletById.get(alert.outletId);
  return (
    <Link to={alertHref(alert)} className={cn('group flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-white hover:shadow-card', className)}>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', alert.status === 'TRIGGERED' ? 'bg-brand-600 text-white' : alert.category === 'COMFORT' ? 'bg-sky-100 text-sky-500' : 'bg-ink text-white')}>
        <SensorIcon type={alert.sensorType} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{alert.message}</span>
        <span className="block truncate text-xs text-muted">{outlet?.name}{compact ? '' : ` · ${alert.sensorName}`}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <AlertStatusBadge status={alert.status} />
        <span className="text-[11px] text-muted">{fmtRelativeDay(alert.triggerTime)}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-silver transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
