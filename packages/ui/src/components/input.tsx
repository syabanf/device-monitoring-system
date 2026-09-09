import * as React from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightSlot, type = 'text', ...props }, ref) => (
    <div className={cn('relative flex items-center', className)}>
      {leftIcon ? <span className="pointer-events-none absolute left-3 text-muted [&_svg]:size-4">{leftIcon}</span> : null}
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground placeholder:text-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-surface',
          leftIcon && 'pl-10',
          rightSlot && 'pr-11',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500/25',
        )}
        {...props}
      />
      {rightSlot ? <span className="absolute right-2 flex items-center">{rightSlot}</span> : null}
    </div>
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-28 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
        error && 'border-red-500',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn('mb-1.5 block text-sm font-medium text-foreground', className)} {...props} />
);

export function FormField({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor?: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-0', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-700" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
