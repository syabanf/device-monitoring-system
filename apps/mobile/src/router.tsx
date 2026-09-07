import { Navigate, createBrowserRouter } from 'react-router';
import { RequireAuth } from './auth/auth';
import { MobileLayout } from './layouts/MobileLayout';
import { LoginPage } from './pages/LoginPage';
import { AlertsPage } from './pages/AlertsPage';
import { AlertDetailPage } from './pages/AlertDetailPage';
import { DevicesPage } from './pages/DevicesPage';
import { AccountPage } from './pages/AccountPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { ReportIssuePage } from './pages/ReportIssuePage';
import { useAuth } from './auth/auth';

function Home() {
  const { user } = useAuth();
  return <Navigate to={user?.kind === 'technician' ? '/maintenance' : '/alerts'} replace />;
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      path: '/',
      element: <RequireAuth><MobileLayout /></RequireAuth>,
      children: [
        { index: true, element: <Home /> },
        { path: 'alerts', element: <AlertsPage /> },
        { path: 'alerts/:id', element: <AlertDetailPage /> },
        { path: 'devices', element: <DevicesPage /> },
        { path: 'maintenance', element: <MaintenancePage /> },
        { path: 'maintenance/new', element: <ReportIssuePage /> },
        { path: 'maintenance/:id', element: <TicketDetailPage /> },
        { path: 'account', element: <AccountPage /> },
        { path: '*', element: <Navigate to="/alerts" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
