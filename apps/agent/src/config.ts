import path from 'node:path';
import dotenv from 'dotenv';

declare const __RICOZ_DEFAULT_API_URL__: string | undefined;

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  apiUrl: (
    (typeof __RICOZ_DEFAULT_API_URL__ === 'undefined' ? undefined : __RICOZ_DEFAULT_API_URL__) ||
    process.env.API_URL ||
    'http://localhost:3001/api'
  ).replace(/\/$/, ''),
  enrollmentToken: process.env.ENROLLMENT_TOKEN || '',
  heartbeatIntervalMs: intFromEnv(process.env.HEARTBEAT_INTERVAL_MS, 60_000),
  telemetryIntervalMs: intFromEnv(process.env.TELEMETRY_INTERVAL_MS, 600_000),
  agentVersion: process.env.AGENT_VERSION || '0.1.0',
  agentStateFile: process.env.AGENT_STATE_FILE || defaultStateFile(),
  // ── Connection / retry tuning ──────────────────────────────────────────
  /** Per-request HTTP timeout. Keeps a hung network from stalling the loop. */
  requestTimeoutMs: intFromEnv(process.env.AGENT_REQUEST_TIMEOUT_MS, 30_000),
  /** Base delay for exponential backoff between failed heartbeat attempts. */
  backoffBaseMs: intFromEnv(process.env.AGENT_BACKOFF_BASE_MS, 5_000),
  /** Upper bound for backoff delay (jittered). Prevents runaway waits. */
  backoffMaxMs: intFromEnv(process.env.AGENT_BACKOFF_MAX_MS, 300_000),
  /** How many times a command-result report is retried before it is queued. */
  commandResultRetries: intFromEnv(process.env.AGENT_RESULT_RETRIES, 3),
};

function defaultStateFile(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || process.env.ProgramData || '';
    return path.join(appData, 'RicozEndpoint', 'agent.json');
  }
  return path.join(process.env.HOME ?? '', '.ricoz-agent', 'agent.json');
}