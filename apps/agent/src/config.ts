import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  apiUrl: (process.env.API_URL || 'http://localhost:3001/api').replace(/\/$/, ''),
  enrollmentToken: process.env.ENROLLMENT_TOKEN || '',
  heartbeatIntervalMs: intFromEnv(process.env.HEARTBEAT_INTERVAL_MS, 60_000),
  telemetryIntervalMs: intFromEnv(process.env.TELEMETRY_INTERVAL_MS, 600_000),
  agentVersion: process.env.AGENT_VERSION || '0.1.0',
  agentStateFile: process.env.AGENT_STATE_FILE || defaultStateFile(),
};

function defaultStateFile(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || process.env.ProgramData || '';
    return path.join(appData, 'RicozEndpoint', 'agent.json');
  }
  return path.join(process.env.HOME ?? '', '.ricoz-agent', 'agent.json');
}