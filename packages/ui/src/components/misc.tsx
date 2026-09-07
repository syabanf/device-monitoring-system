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

export function StatCard({ label, value, hint, icon, tone = 'default', className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: 'default' | 'danger' | 'success' | 'warning'; className?: string }) {
  const toneCls = { default: 'bg-surface text-body', danger: 'bg-brand-600 text-white', success: 'bg-ink text-white', warning: 'bg-sky-300 text-ink' }[tone];
  return (
    <div className={cn('flex flex-col gap-4 rounded-card bg-card p-5 shadow-card', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px]', toneCls)}>{icon}</div> : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-3xl font-bold leading-none tracking-tight text-foreground">{value}</p>
        {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, className }: { title: string; description?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-start justify-between gap-3', className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
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
