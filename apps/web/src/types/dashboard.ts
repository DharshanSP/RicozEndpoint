export type AlertSeverity = 'critical' | 'warning' | 'info';
export type EventStatus = 'success' | 'warning' | 'info' | 'error';
export type ComplianceStatus = 'Compliant' | 'At Risk' | 'Non-Compliant';

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
  openAlertsCount: number;
  criticalAlertsCount: number;
  warningAlertsCount: number;
  osDistribution: OsDistributionItem[];
  complianceControls: ComplianceControlItem[];
  activeAlerts: DashboardAlertItem[];
  recentEvents: DashboardEventItem[];
}
