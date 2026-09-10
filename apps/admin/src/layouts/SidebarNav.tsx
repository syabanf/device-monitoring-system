import * as React from 'react';
import { Link, matchPath, useLocation } from 'react-router';
import { Building2, LogOut, MapPin, Plug, Plus, Users, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { distributorById } from '@monitoring/fixtures';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Rail, RailAction, RailGroup, RailItem, RailWorkspace, Sidebar, SidebarItem, WitMark } from '@monitoring/ui';
import { NAV_SECTIONS } from './nav-items';
import { useScoped } from '../state/app-state';
import { useAuth } from '../auth/auth';

export function Brand({ dark }: { dark?: boolean }) {
  return <div className="flex items-center gap-2.5"><WitMark dark={dark} /><span className={dark ? 'text-xs font-medium text-sidebar-muted' : 'text-xs font-medium text-muted'}>Monitoring</span></div>;
}

const EXPAND_KEY = 'ms.admin.sidebar';
function readExpanded() { try { return localStorage.getItem(EXPAND_KEY) === '1'; } catch { return false; } }

export function RailNav({ onAdd }: { onAdd?: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { alerts, outlets } = useScoped();
  const { logout, session } = useAuth();
  const distributor = session ? distributorById.get(session.distributorId) : undefined;
  const [expanded, setExpanded] = React.useState(readExpanded);
  const toggle = () => setExpanded((v) => { try { localStorage.setItem(EXPAND_KEY, v ? '0' : '1'); } catch { /* ignore */ } return !v; });
  const openCount = alerts.filter((a) => a.status !== 'RESOLVED' && a.status !== 'VERIFIED').length;
  const isActive = (to: string, end?: boolean) => !!matchPath({ path: to, end: !!end }, pathname);

  return (
    <Rail expanded={expanded} onToggle={toggle}
      header={<Link to="/" className={expanded ? 'flex h-11 items-center gap-2.5 rounded-2xl bg-white/5 px-3' : 'flex size-11 items-center justify-center rounded-2xl bg-white/5'}><WitMark dark className="text-lg" />{expanded ? <span className="text-xs font-medium text-sidebar-muted">Monitoring</span> : null}</Link>}
      action={onAdd ? <RailAction label="Add device" onClick={onAdd}><Plus /></RailAction> : undefined}
      workspace={
        <DropdownMenu>
          <DropdownMenuTrigger asChild><RailWorkspace icon={<Building2 />} kicker="Distribution center" name={distributor?.name ?? 'Workspace'} /></DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64">
            <DropdownMenuLabel><span className="block text-sm font-semibold text-foreground">{distributor?.name}</span><span className="block font-normal">{outlets.length} outlets · {distributor?.city}</span></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/outlets')}><MapPin />Outlets</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/users')}><Users />User Management</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/integration')}><Plug />API Integration</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/setup')}><Wand2 />Setup wizard</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => { logout(); navigate('/login'); }}><LogOut />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }>
      {NAV_SECTIONS.map((section) => {
        const active = section.items.some((item) => isActive(item.to, 'end' in item ? item.end : false));
        const primary = section.items[0];
        return (
          <RailGroup key={section.label} icon={<section.icon />} label={section.label} active={active} defaultOpen={active || section.label === 'Operations'}
            collapsedTo={<RailItem asChild icon={<section.icon />} label={section.label} active={active} badge={section.label === 'Operations' ? openCount : undefined}><Link to={primary.to} /></RailItem>}>
            {section.items.map((item) => <RailItem key={item.to} asChild sub icon={<item.icon />} label={item.label} active={isActive(item.to, 'end' in item ? item.end : false)} badge={item.to === '/alerts' ? openCount : undefined}><Link to={item.to} /></RailItem>)}
          </RailGroup>
        );
      })}
    </Rail>
  );
}

export function DrawerNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { alerts } = useScoped();
  const openCount = alerts.filter((a) => a.status !== 'RESOLVED' && a.status !== 'VERIFIED').length;
  const isActive = (to: string, end?: boolean) => !!matchPath({ path: to, end: !!end }, pathname);
  return (
    <Sidebar header={<div className="px-6 py-5"><Brand dark /></div>}>
      {NAV_SECTIONS.map((section) => <div key={section.label} className="pt-1">
        <p className="px-3.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{section.label}</p>
        {section.items.map((item) => <SidebarItem key={item.to} asChild icon={<item.icon />} label={item.label} active={isActive(item.to, 'end' in item ? item.end : false)} badge={item.to === '/alerts' && openCount ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-brand-600">{openCount}</span> : null}><Link to={item.to} onClick={onNavigate} /></SidebarItem>)}
      </div>)}
    </Sidebar>
  );
}
