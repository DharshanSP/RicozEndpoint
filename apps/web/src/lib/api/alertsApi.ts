import { fetchApi } from '../api';
import type {
  AlertListQuery,
  AlertListResponse,
  ResolveAlertPayload,
} from '../../types/alert';

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

/** Lists alerts for the caller organization with optional filters. */
export async function listAlerts(query: AlertListQuery = {}): Promise<AlertListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.status && query.status !== 'ALL') params.set('status', query.status);
  if (query.severity && query.severity !== 'ALL') params.set('severity', query.severity);
  if (query.search) params.set('search', query.search);

  const qs = params.toString();
  return requestBodyEnvelope<AlertListResponse>(`/alerts${qs ? `?${qs}` : ''}`);
}

/** Resolves an open alert with an optional resolution note. */
export async function resolveAlert(id: string, payload: ResolveAlertPayload = {}) {
  return requestBody(`/alerts/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}