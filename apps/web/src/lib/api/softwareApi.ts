import { fetchApi } from '../api';

export interface SoftwareItem {
  id: string;
  name: string;
  publisher: string;
  deviceCount: number;
  latestVersion: string;
  versions: { version: string; count: number }[];
}

export interface SoftwareListResponse {
  items: SoftwareItem[];
  total: number;
  page: number;
  limit: number;
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

export async function deployApplication(data: {
  name: string;
  version: string;
  publisher?: string;
  targetType: 'GROUP' | 'DEVICE';
  targetId: string;
  action: 'INSTALL' | 'UNINSTALL';
}) {
  return fetchApi<{ deploymentId: string; status: string }>('/software/deploy', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
