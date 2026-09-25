import { fetchApi } from '../api';

export interface DeviceGroupMember {
  id: string;
  device?: {
    id: string;
    deviceName: string;
    hostname: string;
    status: string;
  };
}

export interface DeviceGroupAssignment {
  id: string;
  policyId: string;
  priority: number;
  policy?: {
    id: string;
    name: string;
  };
}

export interface DeviceGroup {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  membersCount: number;
  policiesCount: number;
  members?: DeviceGroupMember[];
  assignments?: DeviceGroupAssignment[];
}

export interface DeviceGroupsListResponse {
  items: DeviceGroup[];
  total: number;
  page: number;
  limit: number;
}

export async function getDeviceGroups(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.search) query.append('search', params.search);

  const endpoint = `/device-groups?${query.toString()}`;
  return fetchApi<DeviceGroupsListResponse>(endpoint);
}

export async function getDeviceGroupDetail(id: string) {
  return fetchApi<DeviceGroup>(`/device-groups/${id}`);
}

export async function createDeviceGroup(data: {
  name: string;
  description?: string;
  deviceIds?: string[];
}) {
  return fetchApi<{ id: string; name: string }>('/device-groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDeviceGroup(
  id: string,
  data: { name?: string; description?: string }
) {
  return fetchApi<{ id: string; name: string }>(`/device-groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteDeviceGroup(id: string) {
  return fetchApi<{ id: string }>(`/device-groups/${id}`, {
    method: 'DELETE',
  });
}

export async function addDeviceGroupMembers(id: string, deviceIds: string[]) {
  return fetchApi<{ added: number; skipped: number }>(`/device-groups/${id}/members`, {
    method: 'POST',
    body: JSON.stringify({ deviceIds }),
  });
}

export async function removeDeviceGroupMember(id: string, deviceId: string) {
  return fetchApi<{ removed: boolean }>(`/device-groups/${id}/members/${deviceId}`, {
    method: 'DELETE',
  });
}
