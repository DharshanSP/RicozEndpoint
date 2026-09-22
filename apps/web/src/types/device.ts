/**
 * ============================================================================
 * DEVICE TYPES & DATA MODELS
 * Source of truth: database/prisma/schema.prisma (Device & related models)
 * ============================================================================
 */

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'PENDING';

export interface DeviceHardware {
  id: string;
  deviceId: string;
  cpu: string;
  cpuCores: number;
  ramBytes: number | string;
  storageBytes: number | string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  biosVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceSoftware {
  id: string;
  deviceId: string;
  name: string;
  version: string;
  publisher: string;
  installDate: string | null;
  architecture: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface PolicyAssignment {
  id: string;
  policyId: string;
  deviceId: string | null;
  groupId: string | null;
  priority: number;
  createdAt: string;
  policy?: {
    id: string;
    organizationId: string;
    name: string;
    type: string;
    description: string;
    settings: string;
    isActive: boolean;
  };
}

export interface ComplianceResult {
  id: string;
  deviceId: string;
  ruleId: string | null;
  status: string;
  reason: string;
  evaluatedAt: string;
  rule?: {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    ruleType: string;
    condition: string;
    isActive: boolean;
  };
}

export interface Command {
  id: string;
  organizationId: string;
  deviceId: string;
  type: string;
  status: string;
  requestedBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: string | null;
  errorMessage: string | null;
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
  architecture: string;
  ipAddress: string;
  agentVersion: string;
  status: DeviceStatus | string;
  lastSeenAt: string | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;

  // Optional relations
  hardware?: DeviceHardware | null;
  software?: DeviceSoftware[];
  heartbeats?: DeviceHeartbeat[];
  commands?: Command[];
  policies?: PolicyAssignment[];
  complianceResults?: ComplianceResult[];
  alerts?: Alert[];
  deviceGroups?: DeviceGroupMember[];
}

export type DeviceSortField = 'deviceName' | 'status' | 'os' | 'lastSeenAt' | 'registeredAt';
export type SortOrder = 'asc' | 'desc';

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

export interface DevicePagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DeviceFleetMetrics {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  pendingDevices: number;
}

export interface DeviceListResponseData {
  devices: Device[];
  pagination: DevicePagination;
  metrics: DeviceFleetMetrics;
}

export interface DeviceListApiResponse {
  success: boolean;
  data?: DeviceListResponseData;
  error?: {
    code: string;
    message: string;
  };
}

export interface DeviceDetailApiResponse {
  success: boolean;
  data?: Device;
  error?: {
    code: string;
    message: string;
  };
}
