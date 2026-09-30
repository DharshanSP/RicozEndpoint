import { fetchApi } from '../api';
import type {
  CreatePatchPayload,
  DeployPatchPayload,
  DeployPatchResult,
  DevicePatchListResponse,
  PatchDetailResponse,
  PatchItem,
  PatchListQuery,
  PatchListResponse,
  UpdatePatchPayload,
} from '../../types/patch';

async function requestBody<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi<unknown>(endpoint, init);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res.data as T;
}

async function requestEnvelope<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi<unknown>(endpoint, init);
  if (!res.success) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res as unknown as T;
}

/** Patch catalog page with coverage counts and the fleet summary. */
export async function listPatches(query: PatchListQuery = {}): Promise<PatchListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.severity && query.severity !== 'ALL') params.set('severity', query.severity);
  if (query.status && query.status !== 'ALL') params.set('status', query.status);
  if (query.search) params.set('search', query.search);

  const qs = params.toString();
  return requestEnvelope<PatchListResponse>(`/patches${qs ? `?${qs}` : ''}`);
}

/** One patch plus the install state of every device in its organization. */
export async function getPatch(patchId: string): Promise<PatchDetailResponse> {
  return requestEnvelope<PatchDetailResponse>(`/patches/${encodeURIComponent(patchId)}`);
}

/** Every catalog patch alongside its state on a single device. */
export async function getDevicePatches(deviceId: string): Promise<DevicePatchListResponse> {
  return requestEnvelope<DevicePatchListResponse>(
    `/patches/device/${encodeURIComponent(deviceId)}`
  );
}

export async function createPatch(payload: CreatePatchPayload): Promise<PatchItem> {
  return requestBody<PatchItem>('/patches', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePatch(
  patchId: string,
  payload: UpdatePatchPayload
): Promise<PatchItem> {
  return requestBody<PatchItem>(`/patches/${encodeURIComponent(patchId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Queues INSTALL_PATCH commands; requires confirmed: true. */
export async function deployPatch(
  patchId: string,
  payload: DeployPatchPayload = {}
): Promise<DeployPatchResult> {
  return requestBody<DeployPatchResult>(`/patches/${encodeURIComponent(patchId)}/deploy`, {
    method: 'POST',
    body: JSON.stringify({ ...payload, confirmed: true }),
  });
}
