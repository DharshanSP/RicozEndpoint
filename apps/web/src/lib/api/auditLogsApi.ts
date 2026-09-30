import { fetchApi } from '../api';

export interface AuditLogItem {
  id: string;
  organizationId: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: string;
  ipAddress: string;
  metadata?: string | null;
  actor?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AuditLogsListResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
}

export async function getAuditLogs(params?: {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.search) query.append('search', params.search);
  if (params?.action) query.append('action', params.action);

  return fetchApi<AuditLogsListResponse>(`/audit-logs?${query.toString()}`);
}
