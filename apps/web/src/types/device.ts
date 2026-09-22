/**
 * ============================================================================
 * DEVICE MANAGEMENT TYPES & DATA MODELS
 * ============================================================================
 */

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
export type SortOrder = DeviceSortOrder;

export type ActivityType = 'HEARTBEAT' | 'COMMAND' | 'ALERT';

export interface ApiError {
  code: string;
  message: string;
}

export interface DevicePagination {
  page: number;
  limit: number;
  pageSize?: number;
  total: number;
  totalPages: number;
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
  deviceId?: string;
  cpu: string;
  cpuCores: number;
  ramBytes: string | number;
  storageBytes: string | number;
  manufacturer: string;
  model: string;
  serialNumber: string;
  biosVersion: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceSoftwareItem {
  id: string;
  deviceId?: string;
  name: string;
  version: string;
  publisher: string;
  installDate: string | null;
  architecture: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DeviceSoftware = DeviceSoftwareItem;

export interface AssignedPolicy {
  id: string;
  policyId?: string;
  deviceId?: string | null;
  groupId?: string | null;
  priority: number;
  createdAt: string;
  policy: {
    id: string;
    organizationId?: string;
    name: string;
    type: string;
    description: string;
    settings?: string;
    isActive: boolean;
  };
}

export type PolicyAssignment = AssignedPolicy;

export interface ComplianceResult {
  id: string;
  deviceId?: string;
  ruleId?: string | null;
  status: string;
  reason: string | null;
  evaluatedAt: string;
  rule: {
    id: string;
    organizationId?: string;
    name: string;
    ruleType: string;
    description: string;
    condition?: string;
    isActive?: boolean;
  } | null;
}

export interface CommandRecord {
  id: string;
  organizationId?: string;
  deviceId?: string;
  type: string;
  status: string;
  requestedBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: string | null;
  errorMessage: string | null;
}

export type Command = CommandRecord;

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

/* ============================================================================
 * FEATURE / LEGACY COMPATIBILITY TYPES
 * ============================================================================
 */

export interface DeviceHeartbeat {
  id: string;
  deviceId: string;
  agentVersion: string;
  timestamp: string;
  status: string;
  createdAt: string;
}

export interface DeviceGroupMember {
  id: string;
  groupId: string;
  deviceId: string;
  group?: {
    id: string;
    organizationId: string;
    name: string;
    description: string;
  };
}

export interface Alert {
  id: string;
  organizationId: string;
  deviceId: string | null;
  severity: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Device {
  id: string;
  organizationId: string;
  deviceName: string;
  hostname: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  os: string;
  osVersion: string;
  architecture?: string;
  ipAddress: string;
  agentVersion: string;
  status: DeviceStatus | string;
  lastSeenAt: string | null;
  registeredAt: string;
  createdAt: string;
  updatedAt?: string;
  complianceStatus?: DeviceComplianceStatus;

  // Optional relations
  hardware?: DeviceHardware | null;
  software?: DeviceSoftwareItem[];
  heartbeats?: DeviceHeartbeat[];
  commands?: CommandRecord[];
  policies?: AssignedPolicy[];
  complianceResults?: ComplianceResult[];
  alerts?: Alert[];
  deviceGroups?: DeviceGroupMember[];
}

export interface DeviceFleetMetrics {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  pendingDevices: number;
}

export interface DeviceFilterParams {
  search?: string;
  status?: string;
  os?: string;
  manufacturer?: string;
  sortBy?: DeviceSortField;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface DeviceListResponseData {
  devices: Device[] | DeviceSummary[];
  pagination: DevicePagination;
  metrics?: DeviceFleetMetrics;
}

export interface DeviceListApiResponse {
  success: boolean;
  data?: DeviceListResponseData;
  error?: ApiError;
}

export interface DeviceDetailApiResponse {
  success: boolean;
  data?: Device;
  error?: ApiError;
}
