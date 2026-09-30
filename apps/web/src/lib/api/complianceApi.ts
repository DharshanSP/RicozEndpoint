import { fetchApi } from '../api';
import type {
  ComplianceDeviceDetailResponse,
  ComplianceRange,
  ComplianceRollupResponse,
  ComplianceStatus,
  EvaluateCompliancePayload,
  EvaluateComplianceResult,
} from '../../types/compliance';

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

export interface ComplianceRollupQuery {
  range?: ComplianceRange;
  /** Filters the returned device list; the summary always covers the fleet. */
  status?: ComplianceStatus | 'ALL';
  page?: number;
  limit?: number;
  search?: string;
}

/** Fleet-wide compliance rollup: score, summary, controls and devices. */
export async function getComplianceRollup(
  query: ComplianceRollupQuery = {}
): Promise<ComplianceRollupResponse> {
  const params = new URLSearchParams();
  if (query.range) params.set('range', query.range);
  if (query.status) params.set('status', query.status);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);

  const qs = params.toString();
  return requestEnvelope<ComplianceRollupResponse>(`/compliance${qs ? `?${qs}` : ''}`);
}

export interface ComplianceDetailQuery {
  limit?: number;
  status?: 'COMPLIANT' | 'NON_COMPLIANT' | 'ALL';
}

/** Per-device compliance summary, current checks and evaluation history. */
export async function getDeviceCompliance(
  deviceId: string,
  query: ComplianceDetailQuery = {}
): Promise<ComplianceDeviceDetailResponse> {
  const params = new URLSearchParams();
  if (query.limit) params.set('limit', String(query.limit));
  if (query.status) params.set('status', query.status);

  const qs = params.toString();
  return requestEnvelope<ComplianceDeviceDetailResponse>(
    `/compliance/device/${encodeURIComponent(deviceId)}${qs ? `?${qs}` : ''}`
  );
}

/** Re-runs compliance evaluation for a device, a batch, or the whole fleet. */
export async function evaluateCompliance(
  payload: EvaluateCompliancePayload
): Promise<EvaluateComplianceResult> {
  return requestBody<EvaluateComplianceResult>('/compliance/evaluate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
