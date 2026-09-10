import * as React from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { Bell, Home, LogOut, Map, MapPin, Menu, Plug, Plus, Search, ShieldCheck, User, Wand2, Wrench } from 'lucide-react';
import { useLocation, matchPath } from 'react-router';
import {
  Avatar, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Input, Sheet, SheetContent,
} from '@monitoring/ui';
import { distributorById } from '@monitoring/fixtures';
import { useAuth } from '../auth/auth';
import { useScoped } from '../state/app-state';
import { DrawerNav, RailNav } from './SidebarNav';
import { PageNavigation } from './PageNavigation';
import { AddDeviceDialog } from '../components/AddDeviceDialog';

export function AdminLayout() {
  const { user, session, logout } = useAuth();
  const { alerts, outlets, devices, sensors, tickets, outletById } = useScoped();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const distributor = session ? distributorById.get(session.distributorId) : undefined;
  const openCount = alerts.filter((a) => a.status !== 'RESOLVED' && a.status !== 'VERIFIED').length;
  const previousOpenCount = React.useRef(openCount);
  const [announcement, setAnnouncement] = React.useState('');
  React.useEffect(() => {
    if (openCount > previousOpenCount.current) setAnnouncement(`${openCount - previousOpenCount.current} new alert${openCount - previousOpenCount.current > 1 ? 's' : ''} received.`);
    previousOpenCount.current = openCount;
  }, [openCount]);

  const searchResults = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const results: { key: string; title: string; detail: string; href: string; icon: React.ReactNode }[] = [];
    for (const outlet of outlets) if (`${outlet.name} ${outlet.code} ${outlet.address}`.toLowerCase().includes(needle)) results.push({ key: `outlet-${outlet.id}`, title: outlet.name, detail: `Outlet · ${outlet.code}`, href: `/outlets/${outlet.id}`, icon: <MapPin /> });
    for (const device of devices) if (`${device.serial} ${device.mac} ${device.ip}`.toLowerCase().includes(needle)) results.push({ key: `device-${device.id}`, title: device.serial, detail: `Device · ${outletById.get(device.outletId)?.name ?? device.outletId}`, href: `/devices/${device.id}`, icon: <ShieldCheck /> });
    for (const sensor of sensors) if (sensor.name.toLowerCase().includes(needle)) results.push({ key: `sensor-${sensor.id}`, title: sensor.name, detail: `Sensor · ${outletById.get(sensor.outletId)?.name ?? sensor.outletId}`, href: `/devices/${sensor.deviceId}`, icon: <ShieldCheck /> });
    for (const alert of alerts) if (`${alert.id} ${alert.message} ${alert.sensorName}`.toLowerCase().includes(needle)) results.push({ key: `alert-${alert.id}`, title: alert.message, detail: `Alert #${alert.id} · ${outletById.get(alert.outletId)?.name ?? alert.outletId}`, href: `/alerts?tab=${alert.status.toLowerCase()}&id=${alert.id}`, icon: <Bell /> });
    for (const ticket of tickets) if (`${ticket.id} ${ticket.title} ${ticket.description}`.toLowerCase().includes(needle)) results.push({ key: `ticket-${ticket.id}`, title: ticket.title, detail: `Ticket ${ticket.id} · ${outletById.get(ticket.outletId)?.name ?? ticket.outletId}`, href: `/devices/maintenance?view=tickets&ticket=${ticket.id}`, icon: <Wrench /> });
    return results.slice(0, 8);
  }, [q, outlets, devices, sensors, alerts, tickets, outletById]);

  const goToResult = (href: string) => { navigate(href); setQ(''); setSearchFocused(false); setSearchOpen(false); };
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults[0]) goToResult(searchResults[0].href);
    else if (q.trim()) goToResult(`/devices?q=${encodeURIComponent(q.trim())}`);
  };

  const searchForm = (
          <form onSubmit={submitSearch} className="relative w-full md:max-w-sm" onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}>
            <Input aria-label="Global search" aria-expanded={searchFocused && q.trim().length >= 2} aria-controls="global-search-results" placeholder="Search outlets, devices, sensors, alerts, tickets…" leftIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="[&_input]:h-11 [&_input]:rounded-full [&_input]:border-0 [&_input]:bg-white [&_input]:shadow-card" />
            {searchFocused && q.trim().length >= 2 ? <div id="global-search-results" aria-label="Search results" className="absolute inset-x-0 top-12 z-50 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-float">
              {searchResults.length ? <>{searchResults.map((result) => <button key={result.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => goToResult(result.href)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted [&_svg]:size-4">{result.icon}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{result.title}</span><span className="block truncate text-xs text-muted">{result.detail}</span></span>
              </button>)}</> : <p className="px-3 py-4 text-center text-sm text-muted">No direct matches. Press Enter to search devices.</p>}
            </div> : null}
          </form>
  );

  return (
    <div className="relative flex h-dvh gap-4 overflow-hidden bg-surface p-3 lg:p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -right-[8%] -top-[30%] h-[120%] w-[70%] opacity-70 blur-xl [background:radial-gradient(45%_40%_at_60%_30%,rgb(237_28_36_/_0.10),transparent_70%),radial-gradient(40%_55%_at_85%_55%,rgb(237_28_36_/_0.07),transparent_70%),radial-gradient(60%_35%_at_40%_8%,rgb(255_180_182_/_0.16),transparent_70%)]" /></div>
      <p className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{announcement}</p>
      <div className="hidden shrink-0 md:block"><RailNav onAdd={() => setAdding(true)} /></div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" hideClose className="w-72 bg-ink p-0"><DrawerNav onNavigate={() => setOpen(false)} /></SheetContent>
      </Sheet>

      <div className="relative flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex h-14 shrink-0 items-center gap-2 sm:gap-3">
          
          <div className="hidden min-w-0 flex-1 md:block">{searchForm}</div>
          <Button variant="ghost" size="icon" className="ml-auto bg-white shadow-card md:hidden" onClick={() => setSearchOpen((v) => !v)} aria-label="Search" aria-expanded={searchOpen}><Search /></Button>
          <Button className="hidden sm:inline-flex" onClick={() => setAdding(true)}><Plus />Add device</Button>
          <Button asChild variant="ghost" size="icon" className="relative bg-white shadow-card" aria-label="Alerts">
            <Link to="/alerts?tab=unacknowledged">
              <Bell />
              {openCount ? <span className="absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-surface bg-brand-600 px-1 text-[10.5px] font-bold text-white">{openCount > 99 ? '99+' : openCount}</span> : null}
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-11 items-center gap-2.5 rounded-full bg-white pl-1.5 pr-3 shadow-card hover:bg-surface-2 focus:outline-none" aria-label="Account menu">
                <Avatar name={user?.name ?? 'Admin'} color={user?.avatarColor} size="sm" className="size-8" />
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block text-sm font-semibold">{user?.name}</span>
                  <span className="block text-[11px] text-muted">{user?.email}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <span className="block text-sm font-semibold text-foreground">{user?.name}</span>
                <span className="block font-normal">{distributor?.name}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/users')}><User />User Management</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/integration')}><Plug />API Integration</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/setup')}><Wand2 />Setup wizard</DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => { logout(); navigate('/login'); }}><LogOut />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        {searchOpen ? <div className="-mt-2 md:hidden">{searchForm}</div> : null}
        <main className="min-h-0 flex-1 overflow-y-auto pb-24 pr-0.5 md:pb-2">
          <PageNavigation />
          <Outlet />
        </main>
        <AddDeviceDialog open={adding} onClose={() => setAdding(false)} />
        <nav aria-label="Primary" className="fixed inset-x-3 bottom-3 z-40 flex h-[68px] items-center justify-between rounded-[22px] bg-ink px-3 shadow-float md:hidden">
          {([['/', 'Home', Home, true], ['/alerts', 'Alerts', Bell, false]] as const).map(([to, label, Icon, end]) => { const active = !!matchPath({ path: to, end }, pathname); return (
            <Link key={to} to={to} aria-label={label} className={`relative flex size-11 items-center justify-center rounded-2xl transition-colors ${active ? 'bg-brand-600 text-white shadow-[0_8px_20px_-6px_rgb(237_28_36_/_0.7)]' : 'text-sidebar-muted hover:text-white'}`}><Icon className="size-5" />{to === '/alerts' && openCount && !active ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-600">{openCount > 99 ? '99+' : openCount}</span> : null}</Link>
          ); })}
          <button type="button" onClick={() => setAdding(true)} aria-label="Add device" className="flex size-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_6px_18px_rgb(237_28_36_/_0.45)]"><Plus className="size-5" /></button>
          {([['/shopfloor', 'Shopfloor', Map], ['/devices', 'Devices', ShieldCheck]] as const).map(([to, label, Icon]) => { const active = pathname.startsWith(to); return (
            <Link key={to} to={to} aria-label={label} className={`flex size-11 items-center justify-center rounded-2xl transition-colors ${active ? 'bg-brand-600 text-white shadow-[0_8px_20px_-6px_rgb(237_28_36_/_0.7)]' : 'text-sidebar-muted hover:text-white'}`}><Icon className="size-5" /></Link>
          ); })}
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="flex size-11 items-center justify-center rounded-2xl text-sidebar-muted hover:text-white"><Menu className="size-5" /></button>
        </nav>
      </div>
    </div>
  );
}
