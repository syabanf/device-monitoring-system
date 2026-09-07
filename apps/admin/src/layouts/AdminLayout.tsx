import * as React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Bell, LogOut, Menu, Plug, Plus, Search, User, Wand2 } from 'lucide-react';
import {
  Avatar, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Input, Sheet, SheetContent,
} from '@monitoring/ui';
import { distributorById } from '@monitoring/fixtures';
import { useAuth } from '../auth/auth';
import { useScoped } from '../state/app-state';
import { DrawerNav, RailNav } from './SidebarNav';
import { pageTitle } from './nav-items';
import { AddDeviceDialog } from '../components/AddDeviceDialog';

export function AdminLayout() {
  const { user, session, logout } = useAuth();
  const { alerts } = useScoped();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const distributor = session ? distributorById.get(session.distributorId) : undefined;
  const openCount = alerts.filter((a) => a.status === 'TRIGGERED').length;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/devices?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="flex h-dvh gap-4 overflow-hidden bg-surface p-3 lg:p-4">
      <div className="hidden shrink-0 lg:block"><RailNav /></div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" hideClose className="w-72 bg-ink p-0"><DrawerNav onNavigate={() => setOpen(false)} /></SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex h-14 shrink-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="bg-white shadow-card lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></Button>
          <div className="hidden min-w-0 md:block">
            <h2 className="truncate text-lg font-bold leading-tight">{pageTitle(pathname)}</h2>
            <p className="truncate text-xs text-muted">{distributor?.name}</p>
          </div>
          <form onSubmit={submitSearch} className="ml-auto w-full max-w-sm md:ml-6 md:mr-auto">
            <Input placeholder="Search for device, outlet…" leftIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="[&_input]:h-11 [&_input]:rounded-full [&_input]:border-0 [&_input]:bg-white [&_input]:shadow-card" />
          </form>
          <Button className="hidden sm:inline-flex" onClick={() => setAdding(true)}><Plus />Add device</Button>
          <Button asChild variant="ghost" size="icon" className="relative bg-white shadow-card" aria-label="Alerts">
            <Link to="/alerts?tab=open">
              <Bell />
              {openCount ? <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-600 ring-2 ring-white" /> : null}
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
        <main className="min-h-0 flex-1 overflow-y-auto pb-2 pr-0.5">
          <Outlet />
        </main>
        <AddDeviceDialog open={adding} onClose={() => setAdding(false)} />
      </div>
    </div>
  );
}
