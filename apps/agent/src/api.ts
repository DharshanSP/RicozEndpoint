import { config } from './config';
import type { SystemInfo, SoftwareItem, SecurityState, PatchItem } from './inventory';

export interface EnrollResponse {
  deviceId: string;
  agentToken: string;
  status: string;
}

export interface PendingCommand {
  id: string;
  type: string;
  createdAt: string;
  params?: Record<string, unknown>;
}

export interface PolicyPayload {
  id: string;
  name: string;
  type: string;
  description: string;
  settings: Record<string, unknown>;
  priority: number;
  updatedAt: string;
}

export interface PolicySyncResponse {
  policies: PolicyPayload[];
  contentHash: string;
  appliedAt: string;
}

export interface HeartbeatResponse {
  device: { id: string; status: string; lastSeenAt: string | null };
  heartbeatAt: string;
  pendingCommands: PendingCommand[];
}

async function request<T>(path: string, options: { method?: string; token?: string; body?: unknown; timeoutMs?: number }): Promise<T> {
  const { method = 'GET', token, body, timeoutMs = config.requestTimeoutMs } = options;
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Agent-Token': token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Network failure / DNS / refused / timeout — always retryable.
    throw new AgentApiError(
      error instanceof Error && error.name === 'TimeoutError' ? 'AGENT_REQUEST_TIMEOUT' : 'AGENT_CONNECTION_FAILED',
      error instanceof Error ? `Could not reach API at ${config.apiUrl}${path}: ${error.message}` : 'Could not reach API',
    );
  }

  const json = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  } | null;

  if (!response.ok || !json?.success) {
    const message = json?.error?.message ?? `HTTP ${response.status}`;
    const code = json?.error?.code ?? 'AGENT_REQUEST_FAILED';
    throw new AgentApiError(code, message);
  }
  return json.data as T;
}

/** HTTP-level failures worth retrying (5xx + rate limiting). Auth failures are not. */
export function isRetryableApiError(error: unknown): boolean {
  if (!(error instanceof AgentApiError)) return true;
  return (
    error.code === 'AGENT_CONNECTION_FAILED' ||
    error.code === 'AGENT_REQUEST_TIMEOUT' ||
    error.code === 'AGENT_REQUEST_FAILED' ||
    error.code === 'RATE_LIMITED' ||
    error.code === 'INTERNAL_ERROR'
  );
}

/** Full-jitter exponential backoff: base * 2^attempt capped at max, randomised. */
export function backoffDelayMs(attempt: number, baseMs = config.backoffBaseMs, maxMs = config.backoffMaxMs): number {
  const grown = baseMs * 2 ** Math.max(0, attempt);
  const capped = Math.min(grown, maxMs);
  return Math.floor(Math.random() * (capped + 1));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AgentApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AgentApiError';
  }
}

export function enrollDevice(info: SystemInfo): Promise<EnrollResponse> {
  return request<EnrollResponse>('/enroll', {
    method: 'POST',
    body: {
      enrollmentToken: config.enrollmentToken,
      hostname: info.hostname,
      serialNumber: info.serialNumber,
      os: info.os,
      osVersion: info.osVersion,
      architecture: info.architecture,
      ipAddress: info.ipAddress,
      manufacturer: info.manufacturer,
      model: info.model,
      agentVersion: config.agentVersion,
    },
  });
}

export function sendHeartbeat(
  agentToken: string,
  deviceId: string,
  telemetry: {
    hardware?: SystemInfo;
    software?: SoftwareItem[];
    security?: SecurityState;
    patches?: PatchItem[];
  },
): Promise<HeartbeatResponse> {
  return request<HeartbeatResponse>('/agent/heartbeat', {
    method: 'POST',
    token: agentToken,
    body: {
      deviceId,
      agentVersion: config.agentVersion,
      timestamp: new Date().toISOString(),
      status: 'ONLINE',
      ...(telemetry.hardware ? { hardware: telemetry.hardware } : {}),
      ...(telemetry.software ? { software: { items: telemetry.software } } : {}),
      ...(telemetry.security ? { security: telemetry.security } : {}),
      ...(telemetry.patches ? { patches: { items: telemetry.patches } } : {}),
    },
  });
}

export function fetchPolicies(agentToken: string): Promise<PolicySyncResponse> {
  return request<PolicySyncResponse>('/agent/policies', {
    method: 'GET',
    token: agentToken,
  });
}

export function reportCommandResult(agentToken: string, commandId: string, payload: { status: string; result?: string; errorMessage?: string }): Promise<void> {
  return request(`/agent/commands/${commandId}/result`, {
    method: 'POST',
    token: agentToken,
    body: payload,
  });
}