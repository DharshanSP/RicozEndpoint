import { fetchApi } from '../api';

export interface OrganizationSummary {
  id: string;
  name: string;
  deviceCount: number;
  userCount: number;
  createdAt: string;
}

export interface OrganizationListResponse {
  success: boolean;
  data?: OrganizationSummary[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  error?: { code: string; message: string };
}

/** Lists all organizations. SUPER_ADMIN only. */
export async function listOrganizations(params?: { page?: number; limit?: number; search?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return fetchApi<OrganizationSummary[]>(`/organizations${qs ? `?${qs}` : ''}`);
}

export interface CreateOrganizationPayload {
  name: string;
  admin?: { email: string; name: string; password: string };
}

/** Creates a tenant organization, optionally with its first ORG_ADMIN. SUPER_ADMIN only. */
export async function createOrganization(payload: CreateOrganizationPayload) {
  return fetchApi<{ id: string; name: string; createdAt: string }>('/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Renames an organization or replaces its settings payload. SUPER_ADMIN only. */
export async function updateOrganization(id: string, payload: { name?: string }) {
  return fetchApi<{ id: string; name: string }>(`/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
