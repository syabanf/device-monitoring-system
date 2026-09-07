import * as React from 'react';
import { cn } from '../lib/cn';

/** Pill toggle switch in the smart-home style. */
export function Toggle({ checked, onCheckedChange, label, className, disabled }: { checked: boolean; onCheckedChange?: (v: boolean) => void; label?: string; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-50',
        checked ? 'bg-brand-600' : 'bg-silver/60',
        className,
      )}
    >
      <span className={cn('absolute left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform', checked && 'translate-x-5')} />
    </button>
  );
}

/** Circular / pill icon chip used for controls under a card (e.g. mode buttons). */
export const Chip = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label?: string }>(
  ({ className, active, label, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-active={active}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-white px-3.5 text-xs font-semibold text-body transition-colors hover:bg-surface data-[active=true]:border-brand-600 data-[active=true]:bg-brand-600 data-[active=true]:text-white [&_svg]:size-4',
        !label && 'w-10 px-0',
        className,
      )}
      {...props}
    >
      {children}
      {label ? <span>{label}</span> : null}
    </button>
  ),
);
Chip.displayName = 'Chip';

/** Big readout used in sensor cards: 20 °C */
export function Readout({ value, unit, label, className }: { value: React.ReactNode; unit?: string; label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {label ? <span className="text-xs font-medium text-muted">{label}</span> : null}
      <span className="flex items-start gap-1 leading-none">
        <span className="text-4xl font-bold tracking-tight text-foreground">{value}</span>
        {unit ? <span className="pt-1 text-sm font-semibold text-muted">{unit}</span> : null}
      </span>
    </div>
  );
}
