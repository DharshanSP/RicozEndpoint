export type PatchSeverity = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';

export type PatchStatus = 'PENDING' | 'APPROVED' | 'DEPLOYED';

export type PatchDeviceStatus = 'MISSING' | 'INSTALLED' | 'FAILED';

export interface PatchItem {
  id: string;
  organizationId: string;
  kbNumber: string;
  title: string;
  description: string;
  severity: PatchSeverity;
  category: string;
  status: PatchStatus;
  releaseDate: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatchCoverage extends PatchItem {
  installedCount: number;
  failedCount: number;
  missingCount: number;
  totalDevices: number;
  affectedDevices: number;
}

export interface PatchSummary {
  total: number;
  critical: number;
  important: number;
  optional: number;
  pending: number;
  approved: number;
  deployed: number;
  upToDatePercent: number | null;
}

export interface PatchListQuery {
  page?: number;
  limit?: number;
  severity?: PatchSeverity | 'ALL';
  status?: PatchStatus | 'ALL';
  search?: string;
}

export interface PatchListResponse {
  success: boolean;
  data: {
    items: PatchCoverage[];
    total: number;
    page: number;
    limit: number;
    summary: PatchSummary;
  };
}

export interface PatchCommandRef {
  id: string;
  deviceId?: string;
  status: string;
  createdAt: string;
}

export interface PatchDeviceRow {
  id: string;
  deviceName: string;
  hostname: string;
  ipAddress: string;
  status: string;
  lastSeenAt: string | null;
  patchStatus: PatchDeviceStatus;
  installedAt: string | null;
  lastReportedAt: string | null;
  command: PatchCommandRef | null;
}

export interface PatchDetailResponse {
  success: boolean;
  data: PatchItem & {
    summary: {
      totalDevices: number;
      installed: number;
      failed: number;
      missing: number;
      inFlight: number;
    };
    devices: PatchDeviceRow[];
  };
}

export interface DevicePatchItem extends PatchItem {
  deviceStatus: PatchDeviceStatus;
  installedAt: string | null;
  lastReportedAt: string | null;
  command: PatchCommandRef | null;
}

export interface DevicePatchListResponse {
  success: boolean;
  data: {
    device: {
      id: string;
      deviceName: string;
      hostname: string;
      ipAddress: string;
      status: string;
      lastSeenAt: string | null;
    };
    summary: { total: number; installed: number; failed: number; missing: number };
    items: DevicePatchItem[];
  };
}

export interface CreatePatchPayload {
  kbNumber: string;
  title: string;
  description?: string;
  severity?: PatchSeverity;
  category?: string;
  releaseDate?: string;
  status?: PatchStatus;
}

export interface UpdatePatchPayload {
  title?: string;
  description?: string;
  severity?: PatchSeverity;
  category?: string;
  releaseDate?: string | null;
  status?: PatchStatus;
}

export interface DeployPatchPayload {
  deviceIds?: string[];
  groupIds?: string[];
  confirmed?: boolean;
}

export interface DeployPatchResult {
  patch: PatchItem;
  queued: number;
  skippedInstalled: number;
  skippedInFlight: number;
  deviceIds: string[];
}
