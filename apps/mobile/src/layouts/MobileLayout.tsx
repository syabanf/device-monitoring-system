import * as React from 'react';
import { Link, Outlet, matchPath, useLocation } from 'react-router';
import { Bell, ShieldCheck, User, Wrench } from 'lucide-react';
import { cn } from '@monitoring/ui';
import { useAuth } from '../auth/auth';
import { useAppState, useMobileScope, useReadAlerts } from '../state/app-state';

const TABS = [
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/devices', label: 'Devices', icon: ShieldCheck },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/account', label: 'Account', icon: User },
];

export function MobileLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { alerts, tickets } = useMobileScope(user?.outletIds ?? []);
  const { status, error, clearError, reload, state } = useAppState();
  const loaded = status === 'ready' || state.outlets.length > 0;
  const myOpenTickets = user?.kind === 'technician' ? tickets.filter((t) => t.status !== 'DONE' && t.technicianId === user.id).length : 0;
  const { read } = useReadAlerts();
  const unread = alerts.filter((a) => a.status === 'UNACKNOWLEDGED' && !read.has(a.id)).length;
  const previousUnread = React.useRef(unread);
  const [announcement, setAnnouncement] = React.useState('');
  React.useEffect(() => {
    if (unread > previousUnread.current) setAnnouncement(`${unread - previousUnread.current} new alert${unread - previousUnread.current > 1 ? 's' : ''} received.`);
    previousUnread.current = unread;
  }, [unread]);
  const hideNav = !!matchPath('/alerts/:id', pathname) || !!matchPath('/maintenance/:id', pathname);

  return (
    <PhoneFrame>
      <p className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{announcement}</p>
      <main className={cn('flex-1 px-5 pt-[max(env(safe-area-inset-top),0.75rem)]', hideNav ? 'pb-8' : 'pb-32')}>
        {/* Screens read their outlets from state, so they wait for the first load. */}
        {loaded ? <Outlet /> : status === 'error' ? (
          <div role="alert" className="mt-10 rounded-[24px] bg-white p-5 text-center shadow-card">
            <p className="text-sm font-semibold">The API did not answer</p>
            <p className="mt-1 text-xs text-muted">{error}</p>
            <button type="button" onClick={() => void reload()} className="mt-4 h-11 w-full rounded-full bg-ink text-sm font-semibold text-white">Try again</button>
          </div>
        ) : (
          <div className="space-y-3 pt-6" role="status" aria-live="polite">
            <p className="text-sm text-muted">Loading your outlets…</p>
            {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-[24px] bg-white/70" />)}
          </div>
        )}
      </main>
      {error && status !== 'error' ? (
        <div role="alert" className="fixed inset-x-4 bottom-28 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink p-4 text-xs text-white shadow-float">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={clearError} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 font-semibold">Dismiss</button>
        </div>
      ) : null}
      {!hideNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md">
          <div className="pointer-events-none h-8 bg-gradient-to-t from-surface to-transparent" />
          <div className="safe-b rounded-t-[28px] bg-white shadow-[0_-10px_30px_-14px_rgba(16,17,18,0.25)]">
            <div className="flex items-stretch px-3 pb-2 pt-2">
              {TABS.map((t) => {
                const active = pathname.startsWith(t.to);
                return (
                  <Link key={t.to} to={t.to} aria-label={t.label} aria-current={active ? 'page' : undefined} className="group flex flex-1 flex-col items-center justify-center gap-1 py-1.5">
                    <span className={cn('relative flex h-9 w-14 items-center justify-center rounded-full transition-all', active ? 'bg-brand-600 text-white shadow-[0_8px_18px_-6px_rgb(237_28_36_/_0.6)]' : 'text-muted group-active:bg-surface')}>
                      <t.icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                      {((t.to === '/alerts' && unread) || (t.to === '/maintenance' && myOpenTickets)) && !active ? <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{t.to === '/alerts' ? unread : myOpenTickets}</span> : null}
                    </span>
                    <span className={cn('text-[11px] font-semibold', active ? 'text-brand-600' : 'text-muted')}>{t.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      ) : null}
    </PhoneFrame>
  );
}

/** Plain full-screen PWA wrapper (no device frame). */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">{children}</div>;
}
