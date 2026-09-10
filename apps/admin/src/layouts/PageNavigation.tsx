import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';
import { Button } from '@monitoring/ui';
import { useScoped } from '../state/app-state';

interface Crumb {
  label: string;
  to?: string;
}

export function PageNavigation() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { outletById, deviceById } = useScoped();
  const crumbs = buildCrumbs(pathname, search, outletById, deviceById);
  const isDashboard = pathname === '/';

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="mb-4 flex min-h-8 items-center gap-3">
      {!isDashboard ? (
        <Button type="button" variant="ghost" size="sm" className="-ml-2 shrink-0" onClick={goBack} aria-label="Back to previously opened page">
          <ArrowLeft />Back
        </Button>
      ) : null}
      {!isDashboard ? <span className="h-4 w-px bg-border" aria-hidden="true" /> : null}
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          {crumbs.map((crumb, index) => {
            const current = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {index ? <ChevronRight className="size-3.5 shrink-0 text-silver" aria-hidden="true" /> : null}
                {crumb.to && !current ? (
                  <Link to={crumb.to} className="inline-flex items-center gap-1 truncate hover:text-foreground hover:underline">
                    {index === 0 ? <Home className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 truncate font-medium text-foreground" aria-current={current ? 'page' : undefined}>
                    {index === 0 ? <Home className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

function buildCrumbs(
  pathname: string,
  search: string,
  outletById: Map<string, { name: string }>,
  deviceById: Map<string, { serial: string }>,
): Crumb[] {
  const home: Crumb = { label: 'Dashboard', to: '/' };
  const parts = pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(search);

  if (!parts.length) return [{ label: 'Dashboard' }];
  if (parts[0] === 'outlets') {
    const crumbs: Crumb[] = [home, { label: 'Outlets', to: '/outlets' }];
    if (parts[1]) crumbs.push({ label: outletById.get(parts[1])?.name ?? parts[1] });
    else delete crumbs[1]!.to;
    return crumbs;
  }
  if (parts[0] === 'devices') {
    const crumbs: Crumb[] = [home, { label: 'Devices', to: '/devices' }];
    if (parts[1] === 'types') crumbs.push({ label: 'Device Types' });
    else if (parts[1] === 'maintenance') {
      crumbs.push({ label: 'Maintenance', to: '/devices/maintenance' });
      const ticketId = params.get('ticket');
      if (ticketId) crumbs.push({ label: `Ticket ${ticketId}` });
      else delete crumbs[crumbs.length - 1]!.to;
    } else if (parts[1]) crumbs.push({ label: deviceById.get(parts[1])?.serial ?? parts[1] });
    else delete crumbs[1]!.to;
    return crumbs;
  }

  const labels: Record<string, string> = {
    alerts: 'Alerts',
    shopfloor: 'Shopfloor',
    'contact-persons': 'Contact Persons',
    users: 'User Management',
    analysis: 'Analysis',
    reports: 'Reports',
    integration: 'API Integration',
    setup: 'Setup Wizard',
  };
  const page = labels[parts[0]!] ?? 'Page';
  const crumbs: Crumb[] = [home, { label: page }];
  const alertId = parts[0] === 'alerts' ? params.get('id') : null;
  if (alertId) {
    crumbs[1]!.to = '/alerts';
    crumbs.push({ label: `Alert #${alertId}` });
  }
  return crumbs;
}
