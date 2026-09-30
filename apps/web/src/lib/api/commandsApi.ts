import { fetchApi } from '../api';
import type {
  CommandCreateResponse,
  CommandListResponse,
  CommandType,
  CreateCommandPayload,
} from '../../types/command';

async function requestBodyEnvelope<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi<unknown>(endpoint, init);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res as unknown as T;
}

/** Lists commands org-scoped with optional filters. */
export async function listCommands(query: { page?: number; limit?: number; type?: CommandType } = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.type) params.set('type', query.type);

  const qs = params.toString();
  return requestBodyEnvelope<CommandListResponse>(`/commands${qs ? `?${qs}` : ''}`);
}

/**
 * Issues a command to a device. Destructive command types (LOCK_DEVICE,
 * RESTART_DEVICE, SHUTDOWN_DEVICE) require `confirmed: true`.
 */
export async function createCommand(payload: CreateCommandPayload): Promise<CommandCreateResponse> {
  return requestBodyEnvelope<CommandCreateResponse>('/commands', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}