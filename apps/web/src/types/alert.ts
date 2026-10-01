export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type AlertType =
  | 'DEVICE_OFFLINE'
  | 'COMMAND_FAILED'
  | 'COMPLIANCE_VIOLATION'
  | 'SECURITY'
  | 'POLICY'
  | 'INFO';

export interface AlertDeviceRef {
  id: string;
  deviceName: string;
  hostname: string;
  ipAddress: string;
}

export interface AlertItem {
  id: string;
  organizationId?: string;
  deviceId: string | null;
  type: AlertType | string;
  severity: AlertSeverity | string;
  title: string;
  message: string;
  status: AlertStatus | string;
  createdAt: string;
  resolvedAt: string | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedBy?: string | null;
  resolvedNote?: string | null;
  device?: AlertDeviceRef | null;
}

export interface AlertListResponse {
  success: boolean;
  data?: {
    items: AlertItem[];
    total: number;
    page: number;
    limit: number;
  };
  error?: { code: string; message: string };
}

export interface ResolveAlertPayload {
  note?: string;
}

export interface BatchResolveAlertPayload {
  ids: string[];
  note?: string;
}

export interface AlertListQuery {
  page?: number;
  limit?: number;
  status?: AlertStatus | 'ALL';
  severity?: AlertSeverity | 'ALL';
  type?: AlertType | 'ALL';
  unresolved?: boolean;
  search?: string;
}
