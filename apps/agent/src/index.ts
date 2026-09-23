import { config } from './config';
import { loadState, saveState, type AgentState } from './state';
import { collectInstalledSoftware, collectSecurityState, collectSystemInfo } from './inventory';
import { AgentApiError, enrollDevice, reportCommandResult, sendHeartbeat } from './api';
import { executeCommand } from './commands';
import type { PendingCommand } from './api';

const startedAt = Date.now();
let lastTelemetryAt = 0;
let forceTelemetry = false;

function log(level: 'info' | 'warn' | 'error', message: string): void {
  const ts = new Date().toISOString();
  const line = `[ricoz-agent ${ts}] ${message}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

async function enroll(): Promise<AgentState> {
  log('info', 'Collecting system inventory for enrollment...');
  const info = await collectSystemInfo();
  log('info', `Enrolling device ${info.hostname} (${info.serialNumber})`);
  const result = await enrollDevice(info);
  const state: AgentState = { deviceId: result.deviceId, agentToken: result.agentToken };
  saveState(config.agentStateFile, state);
  log('info', `Enrolled successfully. Device id ${state.deviceId}`);
  return state;
}

export async function processCommands(state: AgentState, pending: PendingCommand[]): Promise<void> {
  for (const command of pending) {
    log('info', `Executing command ${command.id} (${command.type})`);
    try {
      const outcome = await executeCommand(command.type, { agentToken: state.agentToken });
      if (outcome.status === 'COMPLETED' && command.type === 'REFRESH_INVENTORY') {
        forceTelemetry = true;
      }
      await reportCommandResult(state.agentToken, command.id, {
        status: outcome.status,
        ...(outcome.status === 'COMPLETED' ? { result: outcome.result } : { errorMessage: outcome.errorMessage }),
      });
      log('info', `Command ${command.id} -> ${outcome.status}`);
    } catch (error) {
      log('error', `Command ${command.id} failed to report: ${(error as Error).message}`);
    }
  }
}

async function heartbeat(
  state: AgentState,
  includeTelemetry: boolean,
): Promise<void> {
  let hardware;
  let software;
  let security;
  if (includeTelemetry) {
    log('info', 'Collecting hardware/software/security telemetry...');
    const [info, apps, sec] = await Promise.all([
      collectSystemInfo(),
      collectInstalledSoftware(),
      collectSecurityState(),
    ]);
    hardware = info;
    software = apps;
    security = sec;
    log(
      'info',
      `Telemetry collected: ${apps.length} applications, firewall=${sec.firewallEnabled}, antivirus=${sec.antivirusEnabled}`,
    );
  }

  const response = await sendHeartbeat(state.agentToken, state.deviceId, { hardware, software, security });
  log(
    'info',
    `Heartbeat OK: device=${response.device.status}, pendingCommands=${response.pendingCommands.length}`,
  );

  if (includeTelemetry) {
    lastTelemetryAt = Date.now();
    forceTelemetry = false;
  }

  if (response.pendingCommands.length > 0) {
    await processCommands(state, response.pendingCommands);
  }
}

async function loop(state: AgentState): Promise<void> {
  try {
    const includeTelemetry =
      forceTelemetry || Date.now() - lastTelemetryAt >= config.telemetryIntervalMs;
    await heartbeat(state, includeTelemetry);
  } catch (error) {
    if (error instanceof AgentApiError && error.code === 'INVALID_AGENT_TOKEN') {
      log('error', 'Agent token rejected by platform. Re-enrollment required.');
    } else {
      log('error', `Heartbeat failed: ${(error as Error).message}`);
    }
  } finally {
    setTimeout(() => void loop(state), config.heartbeatIntervalMs);
  }
}

async function main(): Promise<void> {
  if (!config.apiUrl) {
    log('error', 'API_URL is not configured');
    process.exit(1);
  }

  log('info', `RicozEndpoint agent ${config.agentVersion} starting (api=${config.apiUrl})`);

  let state = loadState(config.agentStateFile);

  if (!state) {
    if (!config.enrollmentToken) {
      log('error', 'No credentials cached and ENROLLMENT_TOKEN is not set. Refusing to start.');
      process.exit(1);
    }
    const enrollLoop = async (): Promise<void> => {
      try {
        state = await enroll();
      } catch (error) {
        log('error', `Enrollment failed (${(error as Error).message}). Retrying in 30s.`);
        setTimeout(() => void enrollLoop(), 30_000);
      }
    };
    await enrollLoop();
    if (!state) {
      return;
    }
  }

  lastTelemetryAt = startedAt;
  log('info', `Starting heartbeat loop (interval=${config.heartbeatIntervalMs}ms)`);
  const activeState = state;
  setTimeout(() => void loop(activeState), 1000);
}

main().catch((error) => {
  log('error', `Fatal: ${(error as Error).stack ?? (error as Error).message}`);
  process.exit(1);
});