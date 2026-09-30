import { fetchApi } from '../api';

export interface SoftwareItem {
  id: string;
  name: string;
  publisher: string;
  deviceCount: number;
  latestVersion: string;
  versions: { version: string; count: number }[];
  installerUrl: string;
}

export interface SoftwareListResponse {
  items: SoftwareItem[];
  total: number;
  page: number;
  limit: number;
}

export interface DeployApplicationInput {
  name: string;
  version?: string;
  publisher?: string;
  applicationId?: string;
  installerUrl?: string;
  silentArgs?: string;
  targetType: 'GROUP' | 'DEVICE';
  targetId: string;
  action: 'INSTALL' | 'UNINSTALL';
  confirmed?: boolean;
}

export interface DeployApplicationResponse {
  deploymentId: string | null;
  status: string;
  action: 'INSTALL' | 'UNINSTALL';
  deploymentIds: string[];
  queued: number;
  skippedInFlight: number;
  deviceIds: string[];
}

export interface DeploymentItem {
  id: string;
  applicationId: string;
  deviceId: string;
  action: 'INSTALL' | 'UNINSTALL';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  requestedBy: string | null;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  application: { id: string; name: string; version: string; publisher: string; installerUrl: string };
  device: { id: string; deviceName: string; hostname: string; status: string };
  requester: { id: string; name: string; email: string } | null;
}

export interface DeploymentListResponse {
  items: DeploymentItem[];
  total: number;
  page: number;
  limit: number;
  summary: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

export async function getSoftwareCatalog(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.search) query.append('search', params.search);

  return fetchApi<SoftwareListResponse>(`/software?${query.toString()}`);
}

export async function deployApplication(data: DeployApplicationInput) {
  return fetchApi<DeployApplicationResponse>('/software/deploy', {
    method: 'POST',
    body: JSON.stringify({ ...data, confirmed: true }),
  });
}

export async function getDeployments(params?: {
  page?: number;
  limit?: number;
  status?: DeploymentItem['status'];
  action?: DeploymentItem['action'];
  applicationId?: string;
  deviceId?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.status) query.append('status', params.status);
  if (params?.action) query.append('action', params.action);
  if (params?.applicationId) query.append('applicationId', params.applicationId);
  if (params?.deviceId) query.append('deviceId', params.deviceId);

  return fetchApi<DeploymentListResponse>(`/software/deployments?${query.toString()}`);
}
