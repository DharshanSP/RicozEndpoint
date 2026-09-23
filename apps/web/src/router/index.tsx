import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { DevicesPage } from '../pages/DevicesPage';
import { DeviceDetailPage } from '../pages/DeviceDetailPage';
import { EnrollmentTokensPage } from '../pages/EnrollmentTokensPage';
import { PoliciesPage } from '../pages/PoliciesPage';
import { AlertsPage } from '../pages/AlertsPage';
import { CompliancePage } from '../pages/CompliancePage';
import { LoginPage } from '../pages/LoginPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { RouteErrorBoundary } from '../components/ErrorBoundary';
import {
  Layers,
  Package,
  Wrench,
  BarChart3,
  History,
  Users,
  Settings,
} from 'lucide-react';

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
        element: (
          <PlaceholderPage
            title="Device Groups"
            section="DEVICES"
            icon={Layers}
            description="Logical grouping and dynamic tag-based organization of endpoints for targeted management."
            plannedFeatures={[
              'Dynamic rule-based membership (OS version, department, subnet)',
              'Static manual device assignments',
              'Targeted policy scoping per group',
            ]}
            schemaEntities={['DeviceGroup', 'DeviceGroupMember', 'PolicyAssignment']}
          />
        ),
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
        element: (
          <PlaceholderPage
            title="Software Catalog"
            section="MANAGEMENT"
            icon={Package}
            description="Package, deploy, and monitor organizational software distribution across endpoints."
            plannedFeatures={[
              'Centralized enterprise application repository',
              'Silent installation package distribution (MSI, PKG, DEB)',
              'Application version tracking and drift detection',
              'Blacklist enforcement and unauthorized software removal',
            ]}
            schemaEntities={['Application', 'Deployment', 'DeviceSoftware']}
          />
        ),
      },
      {
        path: 'patches',
        element: (
          <PlaceholderPage
            title="Patch Management"
            section="MANAGEMENT"
            icon={Wrench}
            description="Automate vulnerability scanning, patch orchestration, and controlled OS updates."
            plannedFeatures={[
              'CVE vulnerability scanning and patch severity scoring',
              'Zero-day critical update automated rings',
              'Maintenance window scheduling and graceful user reboots',
            ]}
            schemaEntities={['ComplianceRule', 'ComplianceResult']}
          />
        ),
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
        element: (
          <PlaceholderPage
            title="Reports & Analytics"
            section="INSIGHTS"
            icon={BarChart3}
            description="Generate executive summaries, hardware lifecycle analytics, and compliance audit exports."
            plannedFeatures={[
              'One-click PDF/CSV export for external security audits',
              'Fleet hardware age and lifecycle replacement forecasting',
              'Aggregated patch level and compliance score trends',
            ]}
            schemaEntities={['AuditLog', 'ComplianceResult', 'Device']}
          />
        ),
      },
      {
        path: 'audit-logs',
        element: (
          <PlaceholderPage
            title="System Audit Logs"
            section="INSIGHTS"
            icon={History}
            description="Immutable chronological record of administrator actions, policy updates, and API activities."
            plannedFeatures={[
              'Detailed action attribution (Actor ID, IP address, Timestamp)',
              'Resource-level diff tracking for configuration changes',
              'Cryptographically signed tamper-evident event stream',
            ]}
            schemaEntities={['AuditLog', 'User', 'Organization']}
          />
        ),
      },
      {
        path: 'users',
        element: (
          <PlaceholderPage
            title="User & Role Administration"
            section="ADMINISTRATION"
            icon={Users}
            description="Manage administrative accounts, role assignments, and granular RBAC permissions."
            plannedFeatures={[
              'Role assignment (SUPER_ADMIN, ORG_ADMIN, IT_ADMIN, OPERATOR, VIEWER)',
              'Multi-tenant user provisioning and invitation workflows',
              'API token generation and agent authorization credentials',
            ]}
            schemaEntities={['User', 'Organization']}
          />
        ),
      },
      {
        path: 'settings',
        element: (
          <PlaceholderPage
            title="Organization Settings"
            section="ADMINISTRATION"
            icon={Settings}
            description="Configure global organization policies, authentication providers, and agent parameters."
            plannedFeatures={[
              'Single Sign-On (SAML 2.0 / OIDC) configuration',
              'Default agent heartbeat frequency and offline timeout rules',
              'Audit log and telemetry retention periods',
            ]}
            schemaEntities={['Organization', 'AgentToken']}
          />
        ),
      },
    ],
  },
]);
