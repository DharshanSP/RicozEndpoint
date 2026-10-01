import { createInterface } from 'node:readline/promises';
import { config } from './config';
import { clearState, loadState, saveState, type AgentState } from './state';
import { collectInstalledPatches, collectInstalledSoftware, collectSecurityState, collectSystemInfo } from './inventory';
import { AgentApiError, enrollDevice, reportCommandResult, sendHeartbeat } from './api';
import { executeCommand } from './commands';
import type { PendingCommand } from './api';

const startedAt = Date.now();
let lastTelemetryAt = 0;
let forceTelemetry = false;

/** Auth failures that only a fresh enrollment can fix. */
const REENROLL_CODES = new Set(['INVALID_AGENT_TOKEN', 'EXPIRED_AGENT_TOKEN', 'AGENT_TOKEN_REQUIRED']);

let state: AgentState | null = loadState(config.agentStateFile);
let enrolling = false;

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

async function promptForEnrollmentToken(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('ENROLLMENT_TOKEN is not set and no interactive terminal is available.');
  }

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const token = (await terminal.question('Paste enrollment token from the web page: ')).trim();
    if (!token) throw new Error('Enrollment token cannot be empty.');
    return token;
  } finally {
    terminal.close();
  }
}

async function enroll(): Promise<AgentState> {
  log('info', 'Collecting system inventory for enrollment...');
  const info = await collectSystemInfo();
  log('info', `Enrolling device ${info.hostname} (${info.serialNumber})`);
  const result = await enrollDevice(info);
  const enrolled: AgentState = { deviceId: result.deviceId, agentToken: result.agentToken };
  saveState(config.agentStateFile, enrolled);
  log('info', `Enrolled successfully. Device id ${enrolled.deviceId}`);
  return enrolled;
}

/**
 * Drops cached credentials and enrolls again with ENROLLMENT_TOKEN.
 * The state file is cleared first so a restart also re-enrolls instead of
 * retrying with dead credentials forever.
 */
function startEnrollment(reason: string): void {
  if (enrolling) return;

  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  if (!interactive && !config.enrollmentToken) {
    log('error', `${reason}, and ENROLLMENT_TOKEN is not set. Set it in .env and restart the agent.`);
    process.exit(1);
    return;
  }

  enrolling = true;
  clearState(config.agentStateFile);
  state = null;
  log('warn', `${reason}. Re-enrollment required.`);
  let needsToken = true;

  const attempt = async (): Promise<void> => {
    try {
      if (needsToken) {
        if (interactive) {
          config.enrollmentToken = await promptForEnrollmentToken();
        }
        needsToken = false;
      }
      state = await enroll();
      enrolling = false;
      lastTelemetryAt = 0; // full telemetry on the first healthy heartbeat
      log('info', 'Re-enrollment complete; resuming heartbeat loop');
    } catch (error) {
      if (
        error instanceof AgentApiError &&
        ['INVALID_ENROLLMENT_TOKEN', 'ENROLLMENT_TOKEN_EXPIRED', 'ENROLLMENT_TOKEN_EXHAUSTED'].includes(error.code)
      ) {
        log('error', `Enrollment token rejected: ${error.message}`);
        if (!interactive) {
          log('error', 'Set a fresh ENROLLMENT_TOKEN and restart the agent.');
          process.exit(1);
          return;
        }
        config.enrollmentToken = '';
        needsToken = true;
        void attempt();
        return;
      }
      log('error', `Enrollment failed (${(error as Error).message}). Retrying in 30s.`);
      setTimeout(() => void attempt(), 30_000);
    }
  };
  void attempt();
}

export async function processCommands(state: AgentState, pending: PendingCommand[]): Promise<void> {
  for (const command of pending) {
    log('info', `Executing command ${command.id} (${command.type})`);
    try {
      const outcome = await executeCommand(command.type, {
        agentToken: state.agentToken,
        params: command.params ?? {},
      });
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
  let patches;
  if (includeTelemetry) {
    log('info', 'Collecting hardware/software/security telemetry...');
    const [info, apps, sec, hotfixes] = await Promise.all([
      collectSystemInfo(),
      collectInstalledSoftware(),
      collectSecurityState(),
      collectInstalledPatches(),
    ]);
    hardware = info;
    software = apps;
    security = sec;
    patches = hotfixes;
    log(
      'info',
      `Telemetry collected: ${apps.length} applications, ${hotfixes.length} hotfixes, firewall=${sec.firewallEnabled}, antivirus=${sec.antivirusEnabled}`,
    );
  }

  const response = await sendHeartbeat(state.agentToken, state.deviceId, {
    hardware,
    software,
    security,
    patches,
  });
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

async function loop(): Promise<void> {
  const activeState = state;
  if (!activeState || enrolling) {
    setTimeout(() => void loop(), config.heartbeatIntervalMs);
    return;
  }

  try {
    const includeTelemetry =
      forceTelemetry || Date.now() - lastTelemetryAt >= config.telemetryIntervalMs;
    await heartbeat(activeState, includeTelemetry);
  } catch (error) {
    if (error instanceof AgentApiError && REENROLL_CODES.has(error.code)) {
      startEnrollment(`Agent credentials rejected (${error.code})`);
    } else {
      log('error', `Heartbeat failed: ${(error as Error).message}`);
    }
  } finally {
    setTimeout(() => void loop(), config.heartbeatIntervalMs);
  }
}

async function main(): Promise<void> {
  if (!config.apiUrl) {
    log('error', 'API_URL is not configured');
    process.exit(1);
  }

  log('info', `RicozEndpoint agent ${config.agentVersion} starting (api=${config.apiUrl})`);

  const cachedState = loadState(config.agentStateFile);
  state = cachedState;

  if (!state) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      config.enrollmentToken = await promptForEnrollmentToken();
    } else if (!config.enrollmentToken) {
      throw new Error('No interactive terminal or ENROLLMENT_TOKEN is available.');
    }
    const enrollLoop = async (): Promise<void> => {
      try {
        state = await enroll();
      } catch (error) {
        if (
          error instanceof AgentApiError &&
          ['INVALID_ENROLLMENT_TOKEN', 'ENROLLMENT_TOKEN_EXPIRED', 'ENROLLMENT_TOKEN_EXHAUSTED'].includes(error.code)
        ) {
          log('error', `Enrollment token rejected: ${(error as Error).message}`);
          config.enrollmentToken = await promptForEnrollmentToken();
          return enrollLoop();
        }
        log('error', `Enrollment failed (${(error as Error).message}). Retrying in 30s.`);
        setTimeout(() => void enrollLoop(), 30_000);
      }
    };
    await enrollLoop();
    if (!state) {
      return;
    }
  }

  lastTelemetryAt = cachedState ? startedAt : 0;
  log('info', `Starting heartbeat loop (interval=${config.heartbeatIntervalMs}ms)`);
  setTimeout(() => void loop(), 1000);
}

main().catch((error) => {
  log('error', `Fatal: ${(error as Error).stack ?? (error as Error).message}`);
  process.exit(1);
});