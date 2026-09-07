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
    <PhoneFrame>
      <main className={cn('flex-1 px-5 pt-[max(env(safe-area-inset-top),0.75rem)] lg:pt-16', hideNav ? 'pb-8' : 'pb-32')}>
        <Outlet />
      </main>
      {!hideNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md lg:absolute lg:bottom-0">
          <div className="pointer-events-none h-8 bg-gradient-to-t from-surface to-transparent" />
          <div className="safe-b rounded-t-[28px] bg-white shadow-[0_-10px_30px_-14px_rgba(16,17,18,0.25)] lg:pb-4">
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

/** On desktop the app is shown inside a modern iPhone frame (Dynamic Island, rounded screen, home indicator). */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex lg:min-h-dvh lg:items-center lg:justify-center lg:bg-[#e9e8ea] lg:py-8">
      <div className="relative lg:h-[852px] lg:w-[393px] lg:rounded-[60px] lg:bg-[#1c1c1e] lg:p-[10px] lg:shadow-[0_40px_80px_-24px_rgba(0,0,0,0.5),inset_0_0_0_2px_#3a3a3c]">
        <div className="pointer-events-none absolute -left-[3px] top-[150px] hidden h-9 w-[3px] rounded-l bg-[#2c2c2e] lg:block" />
        <div className="pointer-events-none absolute -left-[3px] top-[205px] hidden h-16 w-[3px] rounded-l bg-[#2c2c2e] lg:block" />
        <div className="pointer-events-none absolute -left-[3px] top-[280px] hidden h-16 w-[3px] rounded-l bg-[#2c2c2e] lg:block" />
        <div className="pointer-events-none absolute -right-[3px] top-[230px] hidden h-24 w-[3px] rounded-r bg-[#2c2c2e] lg:block" />
        <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface lg:h-full lg:min-h-0 lg:overflow-hidden lg:rounded-[50px]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-50 hidden h-12 items-center justify-between px-8 text-[15px] font-semibold text-foreground lg:flex">
            <span>9:41</span>
            <span className="absolute left-1/2 top-3 h-[34px] w-[120px] -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-1.5">
              <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="0.8" /><rect x="5" y="5.5" width="3" height="6.5" rx="0.8" /><rect x="10" y="3" width="3" height="9" rx="0.8" /><rect x="15" y="0" width="3" height="12" rx="0.8" /></svg>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM8 5.8c1.6 0 3 .6 4.1 1.6l-1.3 1.3A4.1 4.1 0 0 0 8 7.6c-1.1 0-2.1.4-2.8 1.1L3.9 7.4C5 6.4 6.4 5.8 8 5.8zM8 2c2.6 0 5 1 6.8 2.7l-1.3 1.3A7.7 7.7 0 0 0 8 3.8c-2.1 0-4 .8-5.5 2.2L1.2 4.7A9.7 9.7 0 0 1 8 2z" /></svg>
              <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" /><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="currentColor" opacity=".4" /></svg>
            </span>
          </div>
          <div className="flex min-h-full flex-1 flex-col lg:overflow-y-auto lg:[scrollbar-width:none]">{children}</div>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-50 hidden justify-center lg:flex"><span className="h-[5px] w-[134px] rounded-full bg-black/80" /></div>
        </div>
      </div>
    </div>
  );
}
