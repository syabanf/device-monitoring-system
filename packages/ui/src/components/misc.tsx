import * as React from 'react';
import { cn } from '../lib/cn';

export const Separator = ({ className, orientation = 'horizontal' }: { className?: string; orientation?: 'horizontal' | 'vertical' }) => (
  <div role="separator" className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)} />
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-xl bg-surface', className)} />
);

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {icon ? <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-surface text-muted [&_svg]:size-6">{icon}</div> : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-xs text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export type StatTone = 'default' | 'danger' | 'success' | 'warning' | 'info' | 'ink';
const STAT_TONE: Record<StatTone, string> = {
  default: 'bg-surface text-body',
  danger: 'bg-brand-50 text-brand-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-sky-50 text-sky-600',
  ink: 'bg-ink text-white',
};
/** Stat tile: label / big value / hint on the left, a soft-tinted square icon tile top-right. */
export function StatCard({ label, value, hint, icon, tone = 'default', className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: StatTone; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-card bg-card p-5 shadow-card', className)}>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-body/80">{label}</p>
        <p className="mt-1.5 truncate text-[28px] font-extrabold leading-[1.15] tracking-[-0.5px] text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
      {icon ? <div className={cn('flex size-[42px] shrink-0 items-center justify-center rounded-[13px] [&_svg]:size-[18px]', STAT_TONE[tone])}>{icon}</div> : null}
    </div>
  );
}

/** Two-to-four cell split footer for cards (label above bold value), drawn flush with the card edge. */
export function SplitStats({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn('-mx-5 -mb-5 mt-auto grid divide-x divide-border border-t border-border', className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <div key={it.label} className="px-2 py-3 text-center">
          <span className="block text-[10.5px] font-medium text-muted">{it.label}</span>
          <span className="block text-[15px] font-extrabold tabular-nums text-foreground">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ title, description, actions, className }: { title: string; description?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end">{actions}</div> : null}
    </div>
  );
}

export function KeyValue({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-[120px_1fr] gap-3 py-2 text-sm', className)}>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}
