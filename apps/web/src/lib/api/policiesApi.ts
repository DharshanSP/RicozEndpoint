import { fetchApi } from '../api';
import type {
  AssignPolicyPayload,
  CreatePolicyPayload,
  PolicyDetailResponse,
  PolicyListResponse,
  PolicyType,
  UpdatePolicyPayload,
} from '../../types/policy';

async function requestBody<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi<unknown>(endpoint, init);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res.data as T;
}

async function requestBodyEnvelope<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi<unknown>(endpoint, init);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res as unknown as T;
}

export interface PolicyListQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: PolicyType | 'ALL';
  isActive?: 'true' | 'false';
  includeAssignments?: boolean;
}

/** Lists policies for the caller organization with optional filtering. */
export async function listPolicies(query: PolicyListQuery = {}): Promise<PolicyListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.type && query.type !== 'ALL') params.set('type', query.type);
  if (query.isActive) params.set('isActive', query.isActive);
  if (query.includeAssignments) params.set('includeAssignments', 'true');

  const qs = params.toString();
  return requestBodyEnvelope<PolicyListResponse>(`/policies${qs ? `?${qs}` : ''}`);
}

/** Gets a single policy with its assignments. */
export async function getPolicy(id: string): Promise<PolicyDetailResponse> {
  return requestBodyEnvelope<PolicyDetailResponse>(`/policies/${encodeURIComponent(id)}`);
}

/** Creates a new policy. */
export async function createPolicy(payload: CreatePolicyPayload) {
  return requestBody('/policies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Updates an existing policy. */
export async function updatePolicy(id: string, payload: UpdatePolicyPayload) {
  return requestBody(`/policies/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/** Deletes a policy (cascades to assignments). */
export async function deletePolicy(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestBody<{ id: string; deleted: boolean }>(`/policies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Assign or unassign a policy to devices/groups. */
export async function assignPolicy(id: string, payload: AssignPolicyPayload) {
  return requestBody(`/policies/${encodeURIComponent(id)}/assign`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}