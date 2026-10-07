import { createBrowserRouter, Navigate } from 'react-router-dom';
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
import { RegisterPage } from '../pages/RegisterPage';
import { LandingPage } from '../pages/LandingPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { RouteErrorBoundary } from '../components/ErrorBoundary';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/devices',
        element: <DevicesPage />,
      },
      {
        path: '/devices/groups',
        element: <DeviceGroupsPage />,
      },
      {
        path: '/device-groups',
        element: <Navigate to="/devices/groups" replace />,
      },
      {
        path: '/devices/:id',
        element: <DeviceDetailPage />,
      },
      {
        path: '/enrollment-tokens',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']}>
            <EnrollmentTokensPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/policies',
        element: <PoliciesPage />,
      },
      {
        path: '/software',
        element: <SoftwarePage />,
      },
      {
        path: '/patches',
        element: <PatchesPage />,
      },
      {
        path: '/compliance',
        element: <CompliancePage />,
      },
      {
        path: '/alerts',
        element: <AlertsPage />,
      },
      {
        path: '/reports',
        element: <ReportsPage />,
      },
      {
        path: '/audit-logs',
        element: <AuditLogsPage />,
      },
      {
        path: '/users',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <RouteErrorBoundary />,
      },
    ],
  },
  {
    path: '*',
    element: <RouteErrorBoundary />,
  },
]);
