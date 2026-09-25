import { fetchApi } from '../api';
import type {
  ActivityEvent,
  DeviceDetail,
  DeviceHardware,
  DeviceListResponse,
  DeviceSoftwareItem,
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
  pageSize?: number;
  search?: string;
  status?: DeviceStatus | string;
  os?: string;
  manufacturer?: string;
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

/** Returns the full envelope (data + pagination) for paginated list endpoints. */
async function requestBodyEnvelope<T>(endpoint: string): Promise<T> {
  const res = await fetchApi<unknown>(endpoint);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res as unknown as T;
}

/** Lists devices with pagination, search, status/OS filters and sorting. */
export async function listDevices(query: DeviceListQuery = {}): Promise<DeviceListResponse> {
  const params = new URLSearchParams();

  if (query.page) params.set('page', String(query.page));
  const limit = query.limit ?? query.pageSize;
  if (limit) params.set('limit', String(limit));
  if (query.search) params.set('search', query.search);
  if (query.status && query.status !== 'ALL') params.set('status', query.status);
  if (query.os && query.os !== 'ALL') params.set('os', query.os);
  if (query.manufacturer && query.manufacturer !== 'ALL') params.set('manufacturer', query.manufacturer);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const qs = params.toString();
  return requestBodyEnvelope<DeviceListResponse>(`/devices${qs ? `?${qs}` : ''}`);
}

/** Gets full device detail (overview + hardware, software, policies, compliance, commands, activity). */
export async function getDevice(id: string): Promise<DeviceDetail> {
  return requestBody<DeviceDetail>(`/devices/${encodeURIComponent(id)}`);
}

/** Gets a device hardware inventory record (null when the agent has not reported hardware). */
export async function getDeviceHardware(id: string): Promise<DeviceHardware | null> {
  return requestBody<DeviceHardware | null>(`/devices/${encodeURIComponent(id)}/hardware`);
}

/** Gets the installed software inventory for a device. */
export async function getDeviceSoftware(id: string): Promise<DeviceSoftwareItem[]> {
  return requestBody<DeviceSoftwareItem[]>(`/devices/${encodeURIComponent(id)}/software`);
}

/** Gets the merged activity feed (heartbeats, commands, alerts) for a device. */
export async function getDeviceActivity(id: string, limit: number = 20): Promise<ActivityEvent[]> {
  return requestBody<ActivityEvent[]>(
    `/devices/${encodeURIComponent(id)}/activity?limit=${limit}`,
  );
}

export type { Device, DeviceSummary } from '../../types/device';

/** Compatibility aliases for Devices UI hooks and components */
export const getDevices = listDevices;
export const getDeviceById = getDevice;

