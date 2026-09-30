export type PolicyType = 'SECURITY' | 'CONFIGURATION' | 'COMPLIANCE';
export type PasswordComplexity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SecurityPolicySettings {
  firewallRequired?: boolean;
  antivirusRequired?: boolean;
  autoLockMinutes?: number;
  passwordComplexity?: PasswordComplexity;
}

export interface ConfigurationPolicySettings {
  autoUpdates?: boolean;
  registryKeys?: Array<{ path: string; value: unknown }>;
  powerShellScript?: string;
}

export interface CompliancePolicySettings {
  minOsVersion?: string;
  minAgentVersion?: string;
  minDiskFreeGb?: number;
  requiredPatches?: string[];
}

export type PolicySettings =
  | SecurityPolicySettings
  | ConfigurationPolicySettings
  | CompliancePolicySettings;

export type PolicySettingsInput = Partial<PolicySettings>;

export interface PolicyAssignTarget {
  id: string;
  deviceId: string | null;
  groupId: string | null;
  priority: number;
  device?: { id: string; deviceName: string; hostname: string } | null;
  group?: { id: string; name: string } | null;
}

export interface PolicySummary {
  id: string;
  name: string;
  type: PolicyType;
  description: string;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  assignmentsCount: number;
  assignments?: PolicyAssignTarget[];
}

export interface PolicyListResponse {
  success: boolean;
  data?: {
    items: PolicySummary[];
    total: number;
    page: number;
    limit: number;
  };
  error?: { code: string; message: string };
}

export interface PolicyDetailResponse {
  success: boolean;
  data?: PolicySummary;
  error?: { code: string; message: string };
}

export interface CreatePolicyPayload {
  name: string;
  type: PolicyType;
  description?: string;
  settings?: PolicySettingsInput;
  isActive?: boolean;
}

export type UpdatePolicyPayload = Partial<CreatePolicyPayload>;

export interface AssignPolicyPayload {
  deviceIds: string[];
  groupIds?: string[];
  priority?: number;
  removeAssignment?: boolean;
}