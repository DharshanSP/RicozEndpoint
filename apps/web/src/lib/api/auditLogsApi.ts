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
  resource?: string;
  actorId?: string;
  resourceId?: string;
  deviceId?: string;
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.search) query.append('search', params.search);
  if (params?.action) query.append('action', params.action);
  if (params?.resource) query.append('resource', params.resource);
  if (params?.actorId) query.append('actorId', params.actorId);
  if (params?.resourceId) query.append('resourceId', params.resourceId);
  if (params?.deviceId) query.append('deviceId', params.deviceId);
  if (params?.from) query.append('from', params.from);
  if (params?.to) query.append('to', params.to);

  return fetchApi<AuditLogsListResponse>(`/audit-logs?${query.toString()}`);
}

export async function getAuditLog(id: string) {
  return fetchApi<AuditLogItem>(`/audit-logs/${encodeURIComponent(id)}`);
}

export function auditLogsToCsv(items: AuditLogItem[]): string {
  const header = 'timestamp,actor,action,resource,resourceId,ipAddress';
  const rows = items.map((log) =>
    [
      log.timestamp,
      `"${(log.actor?.email ?? log.actorId ?? '').replace(/"/g, '""')}"`,
      log.action,
      log.resource,
      log.resourceId,
      log.ipAddress,
    ].join(',')
  );
  return [header, ...rows].join('\n');
}
