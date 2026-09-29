export interface EnrollmentTokenBoundDevice {
  id: string;
  deviceName: string;
  hostname: string;
  serialNumber?: string;
  status?: string;
}

export interface EnrollmentTokenCreator {
  id: string;
  email: string;
  name: string;
}

export interface EnrollmentTokenSummary {
  id: string;
  label: string;
  device: EnrollmentTokenBoundDevice | null;
  createdBy: EnrollmentTokenCreator | null;
  expiresAt: string | null;
  maxUses: number;
  uses: number;
  remainingUses: number;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface EnrollmentHistoryDevice {
  id: string;
  deviceName: string;
  hostname: string;
  serialNumber: string;
  os: string;
  osVersion: string;
  agentVersion: string;
}

export interface EnrollmentHistoryEntry {
  id: string;
  device: EnrollmentHistoryDevice;
  isCurrent: boolean;
  isRevoked: boolean;
  expiresAt: string | null;
  enrolledAt: string;
}

export interface EnrollmentTokenListResponse {
  success: boolean;
  data: EnrollmentTokenSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreatedEnrollmentToken {
  id: string;
  token: string;
  label: string;
  deviceId: string | null;
  expiresAt: string | null;
  maxUses: number;
  isActive: boolean;
}

export interface CreateEnrollmentTokenPayload {
  label?: string;
  deviceId?: string;
  expiresAt?: string;
  maxUses?: number;
}

export interface EnrollmentTokenListQuery {
  page?: number;
  limit?: number;
  search?: string;
  includeRevoked?: boolean;
}