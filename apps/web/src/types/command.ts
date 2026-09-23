export type CommandType =
  | 'REFRESH_INVENTORY'
  | 'SYNC_POLICY'
  | 'LOCK_DEVICE'
  | 'RESTART_DEVICE'
  | 'SHUTDOWN_DEVICE';

export type CommandStatus =
  | 'QUEUED'
  | 'SENT'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface CreateCommandPayload {
  deviceId: string;
  type: CommandType;
  confirmed?: boolean;
  params?: Record<string, unknown>;
}

export interface CommandCreateResponse {
  success: boolean;
  data?: {
    id: string;
    deviceId: string;
    type: CommandType;
    status: CommandStatus;
    requestedBy: string | null;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    result: string | null;
    errorMessage: string | null;
  };
  error?: { code: string; message: string };
}

export interface CommandListResponse {
  success: boolean;
  data?: {
    items: Array<{
      id: string;
      deviceId: string;
      type: CommandType;
      status: CommandStatus;
      requestedBy: string | null;
      createdAt: string;
      startedAt: string | null;
      completedAt: string | null;
      result: string | null;
      errorMessage: string | null;
      device?: { id: string; deviceName: string; hostname: string } | null;
    }>;
    total: number;
    page: number;
    limit: number;
  };
  error?: { code: string; message: string };
}