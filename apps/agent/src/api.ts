import { config } from './config';
import type { SystemInfo, SoftwareItem } from './inventory';

export interface EnrollResponse {
  deviceId: string;
  agentToken: string;
  status: string;
}

export interface PendingCommand {
  id: string;
  type: string;
  createdAt: string;
}

export interface HeartbeatResponse {
  device: { id: string; status: string; lastSeenAt: string | null };
  heartbeatAt: string;
  pendingCommands: PendingCommand[];
}

async function request<T>(path: string, options: { method?: string; token?: string; body?: unknown }): Promise<T> {
  const { method = 'GET', token, body } = options;
  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Agent-Token': token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

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
  telemetry: { hardware?: SystemInfo; software?: SoftwareItem[] },
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
    },
  });
}

export function reportCommandResult(agentToken: string, commandId: string, payload: { status: string; result?: string; errorMessage?: string }): Promise<void> {
  return request(`/agent/commands/${commandId}/result`, {
    method: 'POST',
    token: agentToken,
    body: payload,
  });
}