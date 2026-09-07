import { BarChart3, FileText, Home, MapPin, Plug, ShieldCheck, UserPlus, Users } from 'lucide-react';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/outlets', label: 'Outlet', icon: MapPin },
  { to: '/contact-persons', label: 'Contact Person', icon: UserPlus },
  {
    label: 'Device',
    icon: ShieldCheck,
    children: [
      { to: '/devices/types', label: 'Device Type' },
      { to: '/devices', label: 'Device Info', end: true },
      { to: '/shopfloor', label: 'Shopfloor', end: false },
      { to: '/devices/maintenance', label: 'Maintenance' },
    ],
  },
  { to: '/users', label: 'User Management', icon: Users },
  { to: '/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/reports', label: 'Report', icon: FileText },
  { to: '/integration', label: 'Integration', icon: Plug },
] as const;

export function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/outlets')) return 'Outlet';
  if (pathname.startsWith('/shopfloor')) return 'Shopfloor';
  if (pathname.startsWith('/contact-persons')) return 'Contact Person';
  if (pathname.startsWith('/devices/types')) return 'Device Type';
  if (pathname.startsWith('/devices/maintenance')) return 'Device Maintenance';
  if (pathname.startsWith('/devices')) return 'Device Info';
  if (pathname.startsWith('/users')) return 'User Management';
  if (pathname.startsWith('/alerts')) return 'Alerts';
  if (pathname.startsWith('/analysis')) return 'Analysis';
  if (pathname.startsWith('/reports')) return 'Report';
  if (pathname.startsWith('/integration')) return 'API Integration';
  if (pathname.startsWith('/setup')) return 'Setup wizard';
  return 'Room Alert';
}
