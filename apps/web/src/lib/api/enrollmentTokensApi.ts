import { fetchApi } from '../api';
import type {
  CreateEnrollmentTokenPayload,
  CreatedEnrollmentToken,
  EnrollmentTokenListQuery,
  EnrollmentTokenListResponse,
} from '../../types/enrollment';

async function requestBody<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi<unknown>(endpoint, init);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res.data as T;
}

/** Lists enrollment tokens for the caller organization. */
export async function listEnrollmentTokens(query: EnrollmentTokenListQuery = {}): Promise<EnrollmentTokenListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.includeRevoked) params.set('includeRevoked', 'true');

  const qs = params.toString();
  return requestBody<EnrollmentTokenListResponse>(`/enrollment-tokens${qs ? `?${qs}` : ''}`);
}

/** Creates an enrollment token and returns the single-use enrollment code. */
export async function createEnrollmentToken(payload: CreateEnrollmentTokenPayload): Promise<CreatedEnrollmentToken> {
  return requestBody<CreatedEnrollmentToken>('/enrollment-tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Revokes an enrollment token. */
export async function revokeEnrollmentToken(id: string): Promise<{ id: string; isActive: boolean }> {
  return requestBody<{ id: string; isActive: boolean }>(`/enrollment-tokens/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}