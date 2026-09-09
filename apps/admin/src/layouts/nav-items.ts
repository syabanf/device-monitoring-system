import { BarChart3, Bell, FileText, Home, MapPin, Plug, Settings, ShieldCheck, UserPlus, Users, Wand2, Wrench } from 'lucide-react';

export const NAV_SECTIONS = [
  { label: 'Operations', icon: Home, items: [
    { to: '/', label: 'Dashboard', icon: Home, end: true },
    { to: '/alerts', label: 'Alerts', icon: Bell },
    { to: '/shopfloor', label: 'Shopfloor', icon: MapPin },
  ] },
  { label: 'Assets', icon: ShieldCheck, items: [
    { to: '/outlets', label: 'Outlets', icon: MapPin },
    { to: '/devices', label: 'Device Info', icon: ShieldCheck, end: true },
    { to: '/devices/types', label: 'Device Types', icon: ShieldCheck },
    { to: '/devices/maintenance', label: 'Maintenance', icon: Wrench },
  ] },
  { label: 'People', icon: Users, items: [
    { to: '/contact-persons', label: 'Contact Persons', icon: UserPlus },
    { to: '/users', label: 'User Management', icon: Users },
  ] },
  { label: 'Insights', icon: BarChart3, items: [
    { to: '/analysis', label: 'Analysis', icon: BarChart3 },
    { to: '/reports', label: 'Reports', icon: FileText },
  ] },
  { label: 'Settings', icon: Settings, items: [
    { to: '/integration', label: 'Integration', icon: Plug },
    { to: '/setup', label: 'Setup Wizard', icon: Wand2 },
  ] },
] as const;

export function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/outlets')) return 'Outlets';
  if (pathname.startsWith('/shopfloor')) return 'Shopfloor';
  if (pathname.startsWith('/contact-persons')) return 'Contact Persons';
  if (pathname.startsWith('/devices/types')) return 'Device Types';
  if (pathname.startsWith('/devices/maintenance')) return 'Device Maintenance';
  if (pathname.startsWith('/devices')) return 'Device Info';
  if (pathname.startsWith('/users')) return 'User Management';
  if (pathname.startsWith('/alerts')) return 'Alerts';
  if (pathname.startsWith('/analysis')) return 'Analysis';
  if (pathname.startsWith('/reports')) return 'Reports';
  if (pathname.startsWith('/integration')) return 'API Integration';
  if (pathname.startsWith('/setup')) return 'Setup Wizard';
  return 'Room Alert';
}
