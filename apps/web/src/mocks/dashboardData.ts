import { DashboardTelemetryData } from '../types/dashboard';

/**
 * Preview / Mock telemetry dataset for the System Admin Dashboard.
 * Used during frontend development while the backend `/api/dashboard` service is being prepared.
 */
export const mockDashboardData: DashboardTelemetryData = {
  totalDevices: 24,
  onlineDevices: 21,
  offlineDevices: 2,
  pendingEnrollment: 1,
  complianceScore: 91.6,
  compliantDevices: 13,
  nonCompliantDevices: 11,
  openAlertsCount: 3,
  criticalAlertsCount: 1,
  warningAlertsCount: 2,
  failedActionsCount: 1,
  osDistribution: [
    { name: 'Windows 11 Pro / Enterprise', count: 14, percentage: 58.3, color: 'bg-blue-500' },
    { name: 'macOS Sonoma / Ventura', count: 7, percentage: 29.2, color: 'bg-indigo-500' },
    { name: 'Linux (Ubuntu / Debian)', count: 3, percentage: 12.5, color: 'bg-emerald-500' },
  ],
  complianceControls: [
    { name: 'Disk Encryption (BitLocker / FileVault)', compliantCount: 23, total: 24, status: 'Compliant' },
    { name: 'Host Firewall Active', compliantCount: 24, total: 24, status: 'Compliant' },
    { name: 'EDR Agent Running', compliantCount: 22, total: 24, status: 'At Risk' },
    { name: 'Critical Security Patches Up-to-Date', compliantCount: 20, total: 24, status: 'At Risk' },
  ],
  activeAlerts: [
    {
      id: 'ALT-1092',
      severity: 'critical',
      title: 'EDR Agent Terminated Unexpectedly',
      hostname: 'SEC-WIN-042.corp.local',
      ipAddress: '10.10.4.88',
      time: '12m ago',
      category: 'Security',
    },
    {
      id: 'ALT-1089',
      severity: 'warning',
      title: 'Pending OS Security Update > 14 Days',
      hostname: 'ENG-MAC-018.corp.local',
      ipAddress: '10.10.2.14',
      time: '1h ago',
      category: 'Patching',
    },
    {
      id: 'ALT-1084',
      severity: 'warning',
      title: 'Heartbeat Threshold Exceeded (Offline > 48h)',
      hostname: 'OPS-LNX-003.corp.local',
      ipAddress: '10.10.6.102',
      time: '3h ago',
      category: 'Availability',
    },
  ],
  recentEvents: [
    {
      id: 'EVT-904',
      type: 'Device Enrollment',
      description: 'New workstation enrolled: FIN-WIN-099',
      actor: 'Agent Daemon v0.1.0',
      time: '18m ago',
      status: 'success',
    },
    {
      id: 'EVT-903',
      type: 'Policy Enforcement',
      description: 'Baseline Security Policy v2.1 applied to 24 endpoints',
      actor: 'Administrator',
      time: '45m ago',
      status: 'info',
    },
    {
      id: 'EVT-902',
      type: 'Heartbeat Lost',
      description: 'Endpoint OPS-LNX-003 missed consecutive heartbeats',
      actor: 'Monitoring Engine',
      time: '3h ago',
      status: 'warning',
    },
    {
      id: 'EVT-901',
      type: 'Remote Command',
      description: 'Remote telemetry sync dispatched to 8 devices',
      actor: 'IT Admin',
      time: '5h ago',
      status: 'success',
    },
  ],
};
