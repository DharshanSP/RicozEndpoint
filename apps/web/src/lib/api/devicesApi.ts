import { fetchApi } from '../api';
import type {
  DeviceActivityResponse,
  DeviceDetailResponse,
  DeviceHardwareResponse,
  DeviceListResponse,
  DeviceSoftwareResponse,
  DeviceSortField,
  DeviceSortOrder,
  DeviceStatus,
} from '../../types/device';

/**
 * ============================================================================
 * DEVICE MANAGEMENT API CONTRACT
 * ============================================================================
 *
 * Base path: /api/devices  (proxied by Vite to the API server on :3001)
 * Auth: Authorization: Bearer <jwt_token> (injected by fetchApi)
 *
 * GET /api/devices?page=&limit=&search=&status=&os=&sortBy=&sortOrder=
 *   -> { success, data: DeviceSummary[], pagination: { page, limit, total, totalPages } }
 *      - status  ∈ ONLINE | OFFLINE | UNKNOWN | PENDING | NON_COMPLIANT
 *      - sortBy  ∈ deviceName | hostname | serialNumber | model | os | osVersion |
 *                 ipAddress | agentVersion | status | lastSeenAt | registeredAt | createdAt ...
 *      - sortOrder ∈ asc | desc
 *      - Errors: 400 VALIDATION_ERROR, 401 UNAUTHORIZED
 *
 * GET /api/devices/:id
 *   -> { success, data: { overview, hardware, software, policies, compliance, commands, activity } }
 *
 * GET /api/devices/:id/hardware  -> { success, data: DeviceHardware | null }
 * GET /api/devices/:id/software  -> { success, data: DeviceSoftwareItem[] }
 * GET /api/devices/:id/activity?limit= -> { success, data: ActivityEvent[] }
 *      - Errors for the above (and detail): 400 VALIDATION_ERROR, 401 UNAUTHORIZED,
 *        404 NOT_FOUND (device missing or outside caller organization)
 * ============================================================================
 */

export interface DeviceListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: DeviceStatus | '';
  os?: string;
  sortBy?: DeviceSortField;
  sortOrder?: DeviceSortOrder;
}

/**
 * fetchApi surfaces the parsed JSON body under `data` with loose typing.
 * This helper returns the fully-typed body and throws on any error response,
 * which lets TanStack Query capture the failure as a query error.
 */
async function requestBody<T>(endpoint: string): Promise<T> {
  const res = await fetchApi<unknown>(endpoint);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res.data as T;
}

/** Lists devices with pagination, search, status/OS filters and sorting. */
export async function listDevices(query: DeviceListQuery = {}): Promise<DeviceListResponse> {
  const params = new URLSearchParams();

  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.os) params.set('os', query.os);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const qs = params.toString();
  return requestBody<DeviceListResponse>(`/devices${qs ? `?${qs}` : ''}`);
}

/** Gets full device detail (overview + hardware, software, policies, compliance, commands, activity). */
export async function getDevice(id: string): Promise<DeviceDetailResponse> {
  return requestBody<DeviceDetailResponse>(`/devices/${encodeURIComponent(id)}`);
}

/** Gets a device hardware inventory record (null when the agent has not reported hardware). */
export async function getDeviceHardware(id: string): Promise<DeviceHardwareResponse> {
  return requestBody<DeviceHardwareResponse>(`/devices/${encodeURIComponent(id)}/hardware`);
}

/** Gets the installed software inventory for a device. */
export async function getDeviceSoftware(id: string): Promise<DeviceSoftwareResponse> {
  return requestBody<DeviceSoftwareResponse>(`/devices/${encodeURIComponent(id)}/software`);
}

/** Gets the merged activity feed (heartbeats, commands, alerts) for a device. */
export async function getDeviceActivity(id: string, limit: number = 20): Promise<DeviceActivityResponse> {
  return requestBody<DeviceActivityResponse>(
    `/devices/${encodeURIComponent(id)}/activity?limit=${limit}`,
  );
}