import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { DevicesPage } from '../pages/DevicesPage';
import { DeviceDetailPage } from '../pages/DeviceDetailPage';
import { DeviceGroupsPage } from '../pages/DeviceGroupsPage';
import { EnrollmentTokensPage } from '../pages/EnrollmentTokensPage';
import { PoliciesPage } from '../pages/PoliciesPage';
import { SoftwarePage } from '../pages/SoftwarePage';
import { PatchesPage } from '../pages/PatchesPage';
import { AlertsPage } from '../pages/AlertsPage';
import { CompliancePage } from '../pages/CompliancePage';
import { ReportsPage } from '../pages/ReportsPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { UsersPage } from '../pages/UsersPage';
import { SettingsPage } from '../pages/SettingsPage';
import { LoginPage } from '../pages/LoginPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { RouteErrorBoundary } from '../components/ErrorBoundary';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'devices',
        element: <DevicesPage />,
      },
      {
        path: 'devices/groups',
        element: <DeviceGroupsPage />,
      },
      {
        path: 'devices/:id',
        element: <DeviceDetailPage />,
      },
      {
        path: 'enrollment-tokens',
        element: <EnrollmentTokensPage />,
      },
      {
        path: 'policies',
        element: <PoliciesPage />,
      },
      {
        path: 'software',
        element: <SoftwarePage />,
      },
      {
        path: 'patches',
        element: <PatchesPage />,
      },
      {
        path: 'compliance',
        element: <CompliancePage />,
      },
      {
        path: 'alerts',
        element: <AlertsPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'audit-logs',
        element: <AuditLogsPage />,
      },
      {
        path: 'users',
        element: <UsersPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
]);
