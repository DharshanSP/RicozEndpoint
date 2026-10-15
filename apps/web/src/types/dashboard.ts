export type AlertSeverity = 'critical' | 'warning' | 'info';
// eventStatusFromAction only ever returns these three (see dashboard.routes.ts).
export type EventStatus = 'success' | 'warning' | 'error';
// Compliance control statuses emitted by the API (see dashboard.routes.ts).
export type ComplianceStatus = 'Compliant' | 'At Risk' | 'Not Evaluated';

export interface OsDistributionItem {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ComplianceControlItem {
  name: string;
  compliantCount: number;
  total: number;
  status: ComplianceStatus | string;
}

export interface DashboardAlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  hostname: string;
  ipAddress: string;
  time: string;
  category: string;
}

export interface DashboardPatchSummary {
  total: number;
  pending: number;
  approved: number;
  deployed: number;
  failedInstalls: number;
}

export interface DashboardEventItem {
  id: string;
  type: string;
  description: string;
  actor: string;
  time: string;
  status: EventStatus;
}

export interface DashboardTelemetryData {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  pendingEnrollment: number;
  complianceScore: number;
  compliantDevices: number;
  nonCompliantDevices: number;
  untestedDevices?: number;
  openAlertsCount: number;
  criticalAlertsCount: number;
  warningAlertsCount: number;
  failedActionsCount: number;
  patchSummary: DashboardPatchSummary;
  osDistribution: OsDistributionItem[];
  complianceControls: ComplianceControlItem[];
  activeAlerts: DashboardAlertItem[];
  recentEvents: DashboardEventItem[];
}
