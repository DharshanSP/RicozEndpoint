export interface EnrollmentTokenBoundDevice {
  id: string;
  deviceName: string;
  hostname: string;
}

export interface EnrollmentTokenSummary {
  id: string;
  label: string;
  device: EnrollmentTokenBoundDevice | null;
  expiresAt: string | null;
  maxUses: number;
  uses: number;
  isActive: boolean;
  createdAt: string;
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