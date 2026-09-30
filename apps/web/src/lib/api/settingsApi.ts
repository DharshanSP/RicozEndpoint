import { fetchApi } from '../api';

export interface OrgSettings {
  agentHeartbeatIntervalSeconds: number;
  alertRetentionDays: number;
  auditRetentionDays: number;
  requireMfa: boolean;
  autoApproveCriticalPatches: boolean;
  allowedIpSubnets?: string[];
}

export interface SettingsResponse {
  organizationId: string;
  name: string;
  settings: OrgSettings;
}

export async function getSettings() {
  return fetchApi<SettingsResponse>('/settings');
}

export async function updateSettings(data: Partial<OrgSettings>) {
  return fetchApi<SettingsResponse>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
