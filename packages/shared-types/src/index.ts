export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  IT_ADMIN = 'IT_ADMIN',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  UNKNOWN = 'UNKNOWN',
  PENDING = 'PENDING',
  NON_COMPLIANT = 'NON_COMPLIANT',
}

export enum CommandStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum CommandType {
  REFRESH_INVENTORY = 'REFRESH_INVENTORY',
  SYNC_POLICY = 'SYNC_POLICY',
  LOCK_DEVICE = 'LOCK_DEVICE',
  RESTART_DEVICE = 'RESTART_DEVICE',
  SHUTDOWN_DEVICE = 'SHUTDOWN_DEVICE',
}

export enum PolicyType {
  SECURITY = 'SECURITY',
  CONFIGURATION = 'CONFIGURATION',
  COMPLIANCE = 'COMPLIANCE',
}

export enum ComplianceStatus {
  COMPLIANT = 'COMPLIANT',
  NON_COMPLIANT = 'NON_COMPLIANT',
  UNKNOWN = 'UNKNOWN',
  NOT_EVALUATED = 'NOT_EVALUATED',
}

/** Event types recorded against a device in its activity feed. */
export type DeviceActivityType = 'HEARTBEAT' | 'COMMAND' | 'ALERT' | 'POLICY' | 'COMPLIANCE';

export interface DeviceActivityEvent {
  id: string;
  type: DeviceActivityType;
  timestamp: string;
  status?: string;
  severity?: string;
  description: string;
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export interface Organization {
  id: string;
  name: string;
  settings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceGroup {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationSettings {
  agentHeartbeatIntervalSeconds: number;
  offlineTimeoutMinutes: number;
  alertRetentionDays: number;
  auditRetentionDays: number;
  defaultPolicyPriority: number;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
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
  status: DeviceStatus;
  lastSeenAt: Date | null;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceHardware {
  id: string;
  deviceId: string;
  cpu: string;
  cpuCores: number;
  ramBytes: bigint;
  storageBytes: bigint;
  manufacturer: string;
  model: string;
  serialNumber: string;
  biosVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceSoftware {
  id: string;
  deviceId: string;
  name: string;
  version: string;
  publisher: string;
  installDate: Date | null;
  architecture: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Policy {
  id: string;
  organizationId: string;
  name: string;
  type: PolicyType;
  description: string;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Command {
  id: string;
  organizationId: string;
  deviceId: string;
  type: CommandType;
  status: CommandStatus;
  requestedBy: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  result: string | null;
  errorMessage: string | null;
}

export interface Alert {
  id: string;
  organizationId: string;
  deviceId: string | null;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: Date;
  ipAddress: string;
  metadata: Record<string, unknown> | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'createdAt' | 'updatedAt'>;
}

export interface HeartbeatPayload {
  deviceId: string;
  agentVersion: string;
  timestamp: string;
  status: DeviceStatus;
}

export interface HardwareInventoryPayload {
  hostname: string;
  cpu: string;
  cpuCores: number;
  ramBytes: number;
  storageBytes: number;
  manufacturer: string;
  model: string;
  serialNumber: string;
  biosVersion: string;
  os: string;
  osVersion: string;
  architecture: string;
}

export interface SoftwareInventoryPayload {
  items: Array<{
    name: string;
    version: string;
    publisher: string;
    installDate: string | null;
    architecture: string;
  }>;
}

export interface RegisterDeviceRequest {
  enrollmentToken: string;
  hostname: string;
  serialNumber: string;
  os: string;
  osVersion: string;
  agentVersion: string;
  manufacturer?: string;
  model?: string;
}

export interface RegisterDeviceResponse {
  deviceId: string;
  token: string;
  heartbeatInterval: number;
}
