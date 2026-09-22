import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cn } from '../lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import indomaretLogo from '../assets/indomaret-logo.webp';

/**
 * The Indomaret logo, as the client supplied it. On a blue surface its own blue bands would
 * disappear into the background, so `plate` sets it on a white tile; `compact` sizes it for the
 * collapsed rail.
 */
export function BrandMark({ className, compact, plate }: { className?: string; compact?: boolean; plate?: boolean }) {
  const logo = (
    <img
      src={indomaretLogo}
      alt="Indomaret"
      width={640}
      height={224}
      draggable={false}
      className={cn('block h-auto shrink-0 select-none', compact ? 'w-9' : 'w-36', !plate && className)}
    />
  );
  if (!plate) return logo;
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-card', className)}>{logo}</span>;
}

const RailCtx = React.createContext<boolean>(false);

/** Floating dark sidebar (desktop): icon rail that can expand to show labels. */
export function Rail({ header, action, workspace, footer, children, className, expanded = false, onToggle }: { header?: React.ReactNode; action?: React.ReactNode; workspace?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode; className?: string; expanded?: boolean; onToggle?: () => void }) {
  return (
    <RailCtx.Provider value={expanded}>
      <aside className={cn('flex h-full flex-col rounded-[28px] bg-ink py-4 text-white shadow-float transition-[width] duration-200', expanded ? 'w-60 px-3' : 'w-[76px] items-center', className)}>
        {header || action ? (
          <div className={cn('mb-4 flex shrink-0 items-center gap-2', expanded ? 'px-1' : 'flex-col gap-3')}>
            {header ? <div className={cn(expanded && 'min-w-0 flex-1')}>{header}</div> : null}
            {action}
          </div>
        ) : null}
        <nav className={cn('flex flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none]', !expanded && 'items-center')}>{children}</nav>
        <div className={cn('mt-2 flex shrink-0 flex-col gap-2', !expanded && 'items-center')}>
          {workspace}
          {footer}
          {onToggle ? (
            <button type="button" onClick={onToggle} aria-label={expanded ? 'Collapse menu' : 'Expand menu'} className={cn('flex h-10 items-center justify-center gap-2 rounded-2xl text-xs font-semibold text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white', expanded ? 'w-full border border-white/10' : 'w-11')}>
              <svg viewBox="0 0 24 24" className={cn('size-4 transition-transform', expanded && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              {expanded ? <span>Collapse menu</span> : null}
            </button>
          ) : null}
        </div>
      </aside>
    </RailCtx.Provider>
  );
}

/** Round accent "create" button that lives in the rail header (REDDIE-style). */
export const RailAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(({ label, className, children, ...props }, ref) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button ref={ref} type="button" aria-label={label} className={cn('flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_6px_18px_rgb(237_28_36_/_0.45)] transition-transform hover:-translate-y-px hover:scale-105 [&_svg]:size-5', className)} {...props}>{children}</button>
    </TooltipTrigger>
    <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent>
  </Tooltip>
));
RailAction.displayName = 'RailAction';

/** Workspace / tenant switcher card at the bottom of the rail. Collapses to a white icon tile. */
export const RailWorkspace = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode; kicker: string; name: string }>(({ icon, kicker, name, className, ...props }, ref) => {
  const expanded = React.useContext(RailCtx);
  const tile = <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-ink [&_svg]:size-4">{icon}</span>;
  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild><button ref={ref} type="button" aria-label={name} className={cn('flex size-11 items-center justify-center rounded-2xl transition-colors hover:bg-white/10', className)} {...props}>{tile}</button></TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>{name}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <button ref={ref} type="button" className={cn('flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-ink-2 p-2.5 text-left transition-colors hover:bg-ink-3', className)} {...props}>
      {tile}
      <span className="min-w-0 flex-1"><span className="block text-[10.5px] font-semibold text-sidebar-muted">{kicker}</span><span className="block truncate text-[12.5px] font-bold text-white">{name}</span></span>
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-sidebar-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
});
RailWorkspace.displayName = 'RailWorkspace';

export interface RailItemProps extends React.HTMLAttributes<HTMLElement> {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  asChild?: boolean;
  sub?: boolean;
}
export const RailItem = React.forwardRef<HTMLElement, RailItemProps>(({ icon, label, active, badge, asChild, sub, className, children, ...props }, ref) => {
  const expanded = React.useContext(RailCtx);
  const Comp = asChild ? Slot : 'button';
  const item = (
    <Comp
      ref={ref as never}
      data-active={active}
      aria-label={label}
      className={cn(
        'relative flex items-center rounded-2xl text-sidebar-muted transition-all hover:bg-white/10 hover:text-white data-[active=true]:bg-brand-600 data-[active=true]:text-white data-[active=true]:shadow-[0_8px_20px_-6px_rgb(237_28_36_/_0.7)] [&_svg]:size-5 [&_svg]:shrink-0',
        expanded ? 'h-11 w-full gap-3 px-3' : 'size-11 justify-center',
        expanded && sub && 'h-9 pl-11 text-[13px] [&_svg]:hidden',
        !expanded && sub && 'size-8 [&_svg]:size-4',
        className,
      )}
      {...props}
    >
      {asChild ? <Slottable>{children}</Slottable> : null}
      {icon}
      {expanded ? <span className="flex-1 truncate text-left text-sm font-medium">{label}</span> : null}
      {badge ? <span className={cn('flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-600', !expanded && 'absolute -right-0.5 -top-0.5')}>{badge > 99 ? '99+' : badge}</span> : null}
    </Comp>
  );
  if (expanded) return item;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent>
    </Tooltip>
  );
});
RailItem.displayName = 'RailItem';

/** Collapsible group inside an expanded rail; renders just the parent icon when collapsed. */
export function RailGroup({ icon, label, active, defaultOpen, children, collapsedTo }: { icon: React.ReactNode; label: string; active?: boolean; defaultOpen?: boolean; children: React.ReactNode; collapsedTo?: React.ReactNode }) {
  const expanded = React.useContext(RailCtx);
  const [open, setOpen] = React.useState(!!defaultOpen);
  if (!expanded) return <>{collapsedTo}</>;
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} data-active={active && !open} className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white data-[active=true]:bg-brand-600 data-[active=true]:text-white [&_svg]:size-5 [&_svg]:shrink-0">
        {icon}
        <span className="flex-1 truncate text-left text-sm font-medium">{label}</span>
        <svg viewBox="0 0 24 24" className={cn('!size-4 transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open ? <div className="mt-0.5 space-y-0.5">{children}</div> : null}
    </div>
  );
}

/** Full-width list sidebar (used in the mobile drawer). */
export function Sidebar({ header, footer, children, className }: { header?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <aside className={cn('flex h-full w-72 flex-col bg-ink text-white', className)}>
      {header ? <div className="shrink-0">{header}</div> : null}
      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">{children}</nav>
      {footer ? <div className="shrink-0 border-t border-white/10 p-4">{footer}</div> : null}
    </aside>
  );
}

export interface SidebarItemProps extends React.HTMLAttributes<HTMLElement> {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: React.ReactNode;
  asChild?: boolean;
  sub?: boolean;
}
export const SidebarItem = React.forwardRef<HTMLElement, SidebarItemProps>(
  ({ icon, label, active, badge, asChild, sub, className, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref as never}
        data-active={active}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white data-[active=true]:bg-brand-600 data-[active=true]:text-white [&_svg]:size-5 [&_svg]:shrink-0',
          sub && 'py-2 pl-12 text-[13px]',
          className,
        )}
        {...props}
      >
        {asChild ? <Slottable>{children}</Slottable> : null}
        {icon}
        <span className="flex-1 truncate">{label}</span>
        {badge}
      </Comp>
    );
  },
);
SidebarItem.displayName = 'SidebarItem';
