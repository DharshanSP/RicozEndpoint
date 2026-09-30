export type ComplianceRange = '1h' | '24h' | '7d' | '30d' | 'all';

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'UNTESTED';

export type ComplianceControlStatus = 'COMPLIANT' | 'AT_RISK' | 'NOT_EVALUATED';

export type ComplianceControlKind = 'RULE' | 'POLICY';

export interface ComplianceSummary {
  totalDevices: number;
  evaluated: number;
  compliant: number;
  nonCompliant: number;
  untested: number;
}

export interface ComplianceControl {
  id: string;
  name: string;
  kind: ComplianceControlKind;
  description: string;
  compliantCount: number;
  nonCompliantCount: number;
  evaluatedCount: number;
  untestedCount: number;
  status: ComplianceControlStatus;
}

export interface ComplianceDeviceRow {
  id: string;
  deviceName: string;
  hostname: string;
  serialNumber: string;
  os: string;
  osVersion: string;
  agentVersion: string;
  status: ComplianceStatus;
  deviceStatus: string;
  lastSeenAt: string | null;
  firewallEnabled: boolean | null;
  antivirusEnabled: boolean | null;
  violations: number;
  checks: number;
  reason: string;
  evaluatedAt: string | null;
}

export interface CompliancePagination {
  page: number;
  limit: number;
  total: number;
}

export interface ComplianceRollup {
  range: ComplianceRange;
  score: number;
  summary: ComplianceSummary;
  controls: ComplianceControl[];
  devices: ComplianceDeviceRow[];
  pagination: CompliancePagination;
}

export interface ComplianceRollupResponse {
  success: boolean;
  data?: ComplianceRollup;
  error?: { code: string; message: string };
}

export interface ComplianceDeviceIdentity {
  id: string;
  deviceName: string;
  hostname: string;
  serialNumber: string;
  os: string;
  osVersion: string;
  agentVersion: string;
  status: string;
  lastSeenAt: string | null;
  firewallEnabled: boolean | null;
  antivirusEnabled: boolean | null;
  organization: { id: string; name: string };
}

export interface ComplianceCheck {
  id: string;
  source: 'RULE' | 'POLICY';
  sourceId: string | null;
  name: string;
  status: string;
  reason: string;
  evaluatedAt: string;
}

export interface ComplianceHistoryEntry {
  id: string;
  status: string;
  reason: string;
  evaluatedAt: string;
  source: 'RULE' | 'POLICY' | 'UNKNOWN';
  sourceName: string;
  sourceId: string | null;
}

export interface ComplianceDeviceDetail {
  device: ComplianceDeviceIdentity;
  summary: {
    status: ComplianceStatus;
    compliant: number;
    nonCompliant: number;
    total: number;
    evaluatedAt: string | null;
  };
  controls: ComplianceCheck[];
  history: ComplianceHistoryEntry[];
  historyTotal: number;
}

export interface ComplianceDeviceDetailResponse {
  success: boolean;
  data?: ComplianceDeviceDetail;
  error?: { code: string; message: string };
}

export interface EvaluateCompliancePayload {
  deviceId?: string;
  deviceIds?: string[];
  all?: boolean;
}

export interface EvaluateComplianceResult {
  evaluated: number;
  violations: number;
  devices: Array<{ deviceId: string; evaluated: number; violation: number }>;
}
