export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'PENDING' | 'NON_COMPLIANT';
export type DeviceComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_EVALUATED';
export type DeviceSortField =
  | 'deviceName'
  | 'hostname'
  | 'serialNumber'
  | 'manufacturer'
  | 'model'
  | 'os'
  | 'osVersion'
  | 'ipAddress'
  | 'agentVersion'
  | 'status'
  | 'lastSeenAt'
  | 'registeredAt'
  | 'createdAt'
  | 'updatedAt';
export type DeviceSortOrder = 'asc' | 'desc';
export type ActivityType = 'HEARTBEAT' | 'COMMAND' | 'ALERT';

export interface ApiError {
  code: string;
  message: string;
}

export interface DeviceSummary {
  id: string;
  deviceName: string;
  hostname: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  os: string;
  osVersion: string;
  ipAddress: string;
  agentVersion: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  registeredAt: string;
  createdAt: string;
  complianceStatus: DeviceComplianceStatus;
}

export interface DevicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DeviceListData {
  devices: DeviceSummary[];
  pagination: DevicePagination;
}

export interface DeviceListResponse {
  success: boolean;
  data?: DeviceSummary[];
  pagination?: DevicePagination;
  error?: ApiError;
}

export interface DeviceHardware {
  id: string;
  cpu: string;
  cpuCores: number;
  ramBytes: string;
  storageBytes: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  biosVersion: string;
}

export interface DeviceSoftwareItem {
  id: string;
  name: string;
  version: string;
  publisher: string;
  installDate: string | null;
  architecture: string;
}

export interface AssignedPolicy {
  id: string;
  priority: number;
  createdAt: string;
  policy: {
    id: string;
    name: string;
    type: string;
    description: string;
    isActive: boolean;
  };
}

export interface ComplianceResult {
  id: string;
  status: string;
  reason: string | null;
  evaluatedAt: string;
  rule: {
    id: string;
    name: string;
    ruleType: string;
    description: string;
  } | null;
}

export interface CommandRecord {
  id: string;
  type: string;
  status: string;
  requestedBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: string | null;
  errorMessage: string | null;
}

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  timestamp: string;
  status?: string;
  severity?: string;
  description: string;
}

export interface DeviceOverview {
  id: string;
  deviceName: string;
  hostname: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  os: string;
  osVersion: string;
  architecture: string | null;
  ipAddress: string;
  agentVersion: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
  complianceStatus: DeviceComplianceStatus;
}

export interface DeviceDetail {
  overview: DeviceOverview;
  hardware: DeviceHardware | null;
  software: DeviceSoftwareItem[];
  policies: AssignedPolicy[];
  compliance: ComplianceResult[];
  commands: CommandRecord[];
  activity: ActivityEvent[];
}

export interface DeviceDetailResponse {
  success: boolean;
  data?: DeviceDetail;
  error?: ApiError;
}

export interface DeviceHardwareResponse {
  success: boolean;
  data?: DeviceHardware | null;
  error?: ApiError;
}

export interface DeviceSoftwareResponse {
  success: boolean;
  data?: DeviceSoftwareItem[];
  error?: ApiError;
}

export interface DeviceActivityResponse {
  success: boolean;
  data?: ActivityEvent[];
  error?: ApiError;
}