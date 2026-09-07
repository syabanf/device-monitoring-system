import { Link, matchPath, useLocation } from 'react-router';
import { Bell, LogOut, type LucideIcon } from 'lucide-react';
import { Badge, Rail, RailGroup, RailItem, Sidebar, SidebarItem, WitMark } from '@monitoring/ui';
import * as React from 'react';
import { NAV } from './nav-items';
import { useScoped } from '../state/app-state';
import { useAuth } from '../auth/auth';

export function Brand({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <WitMark dark={dark} />
      <span className={dark ? 'text-xs font-medium text-sidebar-muted' : 'text-xs font-medium text-muted'}>Monitoring</span>
    </div>
  );
}

const RAIL: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = NAV.map((i) =>
  'children' in i ? { to: '/devices', label: i.label, icon: i.icon } : { to: i.to, label: i.label, icon: i.icon, end: 'end' in i ? i.end : false },
);

const EXPAND_KEY = 'ms.admin.sidebar';
function readExpanded() { try { return localStorage.getItem(EXPAND_KEY) === '1'; } catch { return false; } }

export function RailNav() {
  const { pathname } = useLocation();
  const { alerts } = useScoped();
  const { logout } = useAuth();
  const [expanded, setExpanded] = React.useState(readExpanded);
  const toggle = () => setExpanded((v) => { try { localStorage.setItem(EXPAND_KEY, v ? '0' : '1'); } catch { /* ignore */ } return !v; });
  const openCount = alerts.filter((a) => a.status === 'TRIGGERED').length;
  const isActive = (to: string, end?: boolean) => !!matchPath({ path: to, end: !!end }, pathname);
  const deviceGroup = NAV.find((i) => 'children' in i);
  return (
    <Rail
      expanded={expanded}
      onToggle={toggle}
      header={
        <Link to="/" className={expanded ? 'flex h-11 items-center gap-2.5 rounded-2xl bg-white/5 px-3' : 'flex size-11 items-center justify-center rounded-2xl bg-white/5'}>
          <WitMark dark className="text-lg" />
          {expanded ? <span className="text-xs font-medium text-sidebar-muted">Monitoring</span> : null}
        </Link>
      }
      footer={
        <>
          <RailItem asChild icon={<Bell />} label="Alerts" active={isActive('/alerts')} badge={openCount}><Link to="/alerts" /></RailItem>
          <RailItem icon={<LogOut />} label="Sign out" onClick={logout} />
        </>
      }
    >
      {RAIL.map((item) =>
        item.to === '/devices' && deviceGroup && 'children' in deviceGroup ? (
          <RailGroup
            key="devices"
            icon={<item.icon />}
            label={item.label}
            active={pathname.startsWith('/devices') || pathname.startsWith('/shopfloor')}
            defaultOpen={pathname.startsWith('/devices') || pathname.startsWith('/shopfloor')}
            collapsedTo={<RailItem asChild icon={<item.icon />} label={item.label} active={pathname.startsWith('/devices') || pathname.startsWith('/shopfloor')}><Link to="/devices" /></RailItem>}
          >
            {deviceGroup.children.map((c) => (
              <RailItem key={c.to} asChild sub icon={<item.icon />} label={c.label} active={isActive(c.to, 'end' in c ? c.end : false)}><Link to={c.to} /></RailItem>
            ))}
          </RailGroup>
        ) : (
          <RailItem key={item.to} asChild icon={<item.icon />} label={item.label} active={isActive(item.to, item.end)}>
            <Link to={item.to} />
          </RailItem>
        ),
      )}
    </Rail>
  );
}

export function DrawerNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { alerts } = useScoped();
  const openCount = alerts.filter((a) => a.status === 'TRIGGERED').length;
  const isActive = (to: string, end?: boolean) => !!matchPath({ path: to, end: !!end }, pathname);
  return (
    <Sidebar header={<div className="px-6 py-5"><Brand dark /></div>}>
      {NAV.map((item) =>
        'children' in item ? (
          <div key={item.label} className="pt-1">
            <p className="px-3.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{item.label}</p>
            {item.children.map((c) => (
              <SidebarItem key={c.to} asChild icon={<item.icon />} label={c.label} active={isActive(c.to, 'end' in c ? c.end : false)}>
                <Link to={c.to} onClick={onNavigate} />
              </SidebarItem>
            ))}
          </div>
        ) : (
          <SidebarItem key={item.to} asChild icon={<item.icon />} label={item.label} active={isActive(item.to, 'end' in item ? item.end : false)}>
            <Link to={item.to} onClick={onNavigate} />
          </SidebarItem>
        ),
      )}
      <div className="pt-2">
        <SidebarItem asChild icon={<Bell />} label="Alerts" active={isActive('/alerts')} badge={openCount ? <Badge variant="brand" className="px-2 py-0 text-[11px]">{openCount}</Badge> : null}>
          <Link to="/alerts" onClick={onNavigate} />
        </SidebarItem>
      </div>
    </Sidebar>
  );
}
