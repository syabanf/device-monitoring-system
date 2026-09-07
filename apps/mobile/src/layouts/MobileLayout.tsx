import { Link, Outlet, matchPath, useLocation } from 'react-router';
import { Bell, ShieldCheck, User, Wrench } from 'lucide-react';
import { cn } from '@monitoring/ui';
import { useAuth } from '../auth/auth';
import { useMobileScope, useReadAlerts } from '../state/app-state';

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
  const myOpenTickets = user?.kind === 'technician' ? tickets.filter((t) => t.status !== 'DONE' && t.technicianId === user.id).length : 0;
  const { read } = useReadAlerts();
  const unread = alerts.filter((a) => a.status === 'TRIGGERED' && !read.has(a.id)).length;
  const hideNav = !!matchPath('/alerts/:id', pathname) || !!matchPath('/maintenance/:id', pathname);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface lg:my-6 lg:min-h-[calc(100dvh-3rem)] lg:overflow-hidden lg:rounded-[44px] lg:shadow-float lg:ring-8 lg:ring-ink">
      <main className={cn('safe-t flex-1 px-5 pt-3', hideNav ? 'pb-8' : 'pb-32')}>
        <Outlet />
      </main>
      {!hideNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md lg:absolute">
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
    </div>
  );
}
