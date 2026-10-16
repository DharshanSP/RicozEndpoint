import { fetchApi } from '../api';
import type {
  CreateEnrollmentTokenPayload,
  CreateEnrollmentTokenRequestPayload,
  CreatedEnrollmentToken,
  DecideEnrollmentTokenRequestPayload,
  EnrollmentHistoryEntry,
  EnrollmentTokenListQuery,
  EnrollmentTokenListResponse,
  EnrollmentTokenRequestListQuery,
  EnrollmentTokenRequestListResponse,
  EnrollmentTokenRequestSummary,
  IssuedEnrollmentTokenRequestToken,
} from '../../types/enrollment';

async function requestBody<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi<unknown>(endpoint, init);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res.data as T;
}

/** Returns the full envelope (data + pagination) for paginated list endpoints. */
async function requestBodyEnvelope<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi<unknown>(endpoint, init);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res as unknown as T;
}

/** Lists enrollment tokens for the caller organization. */
export async function listEnrollmentTokens(query: EnrollmentTokenListQuery = {}): Promise<EnrollmentTokenListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.includeRevoked) params.set('includeRevoked', 'true');

  const qs = params.toString();
  return requestBodyEnvelope<EnrollmentTokenListResponse>(`/enrollment-tokens${qs ? `?${qs}` : ''}`);
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

/** Chronological enrollment history, derived from issued agent tokens. */
export async function listEnrollmentHistory(
  query: { page?: number; limit?: number } = {}
): Promise<EnrollmentHistoryEntry[]> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  const qs = params.toString();
  return requestBody<EnrollmentHistoryEntry[]>(`/enrollment-history${qs ? `?${qs}` : ''}`);
}

/** Lists token requests visible to the caller (own requests for operators/viewers). */
export async function listEnrollmentTokenRequests(
  query: EnrollmentTokenRequestListQuery = {}
): Promise<EnrollmentTokenRequestListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.status) params.set('status', query.status);
  const qs = params.toString();
  return requestBodyEnvelope<EnrollmentTokenRequestListResponse>(
    `/enrollment-token-requests${qs ? `?${qs}` : ''}`
  );
}

/** Submits an enrollment token request for administrator approval. */
export async function createEnrollmentTokenRequest(
  payload: CreateEnrollmentTokenRequestPayload
): Promise<EnrollmentTokenRequestSummary> {
  return requestBody<EnrollmentTokenRequestSummary>('/enrollment-token-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Approves a request; the secret is returned only through the reveal endpoint. */
export async function approveEnrollmentTokenRequest(
  id: string,
  payload: DecideEnrollmentTokenRequestPayload = {}
): Promise<EnrollmentTokenRequestSummary> {
  return requestBody<EnrollmentTokenRequestSummary>(`/enrollment-token-requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Denies a pending request with an explanatory note. */
export async function denyEnrollmentTokenRequest(
  id: string,
  payload: DecideEnrollmentTokenRequestPayload
): Promise<EnrollmentTokenRequestSummary> {
  return requestBody<EnrollmentTokenRequestSummary>(`/enrollment-token-requests/${encodeURIComponent(id)}/deny`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Cancels the caller’s own pending request. */
export async function cancelEnrollmentTokenRequest(id: string): Promise<EnrollmentTokenRequestSummary> {
  return requestBody<EnrollmentTokenRequestSummary>(`/enrollment-token-requests/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}

/** Reveals an approved request’s token exactly once. */
export async function revealEnrollmentTokenRequestToken(
  id: string
): Promise<IssuedEnrollmentTokenRequestToken> {
  return requestBody<IssuedEnrollmentTokenRequestToken>(
    `/enrollment-token-requests/${encodeURIComponent(id)}/token`
  );
}