import { createBrowserRouter } from 'react-router';
import { RequireAuth } from './auth/auth';
import { AdminLayout } from './layouts/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OutletsPage } from './pages/outlets/OutletsPage';
import { OutletDetailPage } from './pages/outlets/OutletDetailPage';
import { ContactPersonsPage } from './pages/contacts/ContactPersonsPage';
import { DeviceTypesPage } from './pages/devices/DeviceTypesPage';
import { DevicesPage } from './pages/devices/DevicesPage';
import { DeviceDetailPage } from './pages/devices/DeviceDetailPage';
import { UserManagementPage } from './pages/users/UserManagementPage';
import { AlertsPage } from './pages/alerts/AlertsPage';
import { AnalysisPage } from './pages/analysis/AnalysisPage';
import { ReportPage } from './pages/reports/ReportPage';
import { MaintenancePage } from './pages/devices/MaintenancePage';
import { ShopfloorPage } from './pages/shopfloor/ShopfloorPage';
import { IntegrationPage } from './pages/integration/IntegrationPage';
import { SetupWizardPage } from './pages/setup/SetupWizardPage';

export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      path: '/',
      element: (
        <RequireAuth>
          <AdminLayout />
        </RequireAuth>
      ),
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'outlets', element: <OutletsPage /> },
        { path: 'outlets/:outletId', element: <OutletDetailPage /> },
        { path: 'shopfloor', element: <ShopfloorPage /> },
        { path: 'contact-persons', element: <ContactPersonsPage /> },
        { path: 'devices/types', element: <DeviceTypesPage /> },
        { path: 'devices/maintenance', element: <MaintenancePage /> },
        { path: 'devices', element: <DevicesPage /> },
        { path: 'devices/:deviceId', element: <DeviceDetailPage /> },
        { path: 'users', element: <UserManagementPage /> },
        { path: 'alerts', element: <AlertsPage /> },
        { path: 'analysis', element: <AnalysisPage /> },
        { path: 'reports', element: <ReportPage /> },
        { path: 'integration', element: <IntegrationPage /> },
        { path: 'setup', element: <SetupWizardPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
