import { config } from './config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { clearState, loadState, saveState, type AgentState } from './state';
import { collectInstalledPatches, collectInstalledSoftware, collectSecurityState, collectSystemInfo } from './inventory';
import {
  AgentApiError,
  backoffDelayMs,
  enrollDevice,
  isRetryableApiError,
  reportCommandResult,
  sendHeartbeat,
  sleep,
} from './api';
import { executeCommand } from './commands';
import type { PendingCommand } from './api';

let lastTelemetryAt = 0;
let lastSuccessfulHeartbeatAt = 0;
let consecutiveFailures = 0;
let forceTelemetry = false;
let state: AgentState | null = null;
let enrolling = false;
let shuttingDown = false;
let loopTimer: NodeJS.Timeout | null = null;

/** Command results that could not be reported (offline). Retried on each heartbeat. */
const pendingResults: Array<{ commandId: string; payload: { status: string; result?: string; errorMessage?: string } }> = [];

const REENROLL_CODES = new Set(['INVALID_AGENT_TOKEN', 'EXPIRED_AGENT_TOKEN', 'AGENT_TOKEN_REQUIRED']);
const INVALID_ENROLLMENT_CODES = new Set([
  'INVALID_ENROLLMENT_TOKEN',
  'ENROLLMENT_TOKEN_EXPIRED',
  'ENROLLMENT_TOKEN_EXHAUSTED',
]);

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function printBanner(): void {
  console.log(`${colors.cyan}================================================${colors.reset}`);
  console.log(`${colors.cyan}  RicozEndpoint Windows Agent${colors.reset}`);
  console.log(`${colors.dim}  Secure device enrollment and endpoint telemetry${colors.reset}`);
  console.log(`${colors.cyan}================================================${colors.reset}`);
}

function log(level: 'info' | 'warn' | 'error', message: string): void {
  const prefix = level === 'error' ? `${colors.red}ERROR${colors.reset}` : level === 'warn' ? `${colors.yellow}WARN${colors.reset}` : `${colors.green}OK${colors.reset}`;
  const line = `[${prefix}] ${message}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

async function enroll(): Promise<AgentState> {
  log('info', 'Collecting device information...');
  const info = await collectSystemInfo();
  log('info', `Registering ${info.hostname} (${info.serialNumber})`);
  const result = await enrollDevice(info);
  const state: AgentState = { deviceId: result.deviceId, agentToken: result.agentToken };
  saveState(config.agentStateFile, state);
  log('info', `Device enrolled successfully (${state.deviceId})`);
  return state;
}

export async function processCommands(state: AgentState, pending: PendingCommand[]): Promise<void> {
  for (const command of pending) {
    if (shuttingDown) break;
    log('info', `Executing command ${command.id} (${command.type})`);
    try {
      const outcome = await executeCommand(command.type, {
        agentToken: state.agentToken,
        params: command.params ?? {},
      });
      if (outcome.status === 'COMPLETED' && command.type === 'REFRESH_INVENTORY') {
        forceTelemetry = true;
      }
      await reportResultWithRetry(state, command.id, {
        status: outcome.status,
        ...(outcome.status === 'COMPLETED' ? { result: outcome.result } : { errorMessage: outcome.errorMessage }),
      });
      log('info', `Command ${command.id} -> ${outcome.status}`);
    } catch (error) {
      log('error', `Command ${command.id} failed to report: ${(error as Error).message}`);
    }
  }
}

/** Report a command result with retries; on persistent failure queue it for the next heartbeat. */
async function reportResultWithRetry(
  state: AgentState,
  commandId: string,
  payload: { status: string; result?: string; errorMessage?: string },
): Promise<void> {
  let attempt = 0;
  for (;;) {
    try {
      await reportCommandResult(state.agentToken, commandId, payload);
      return;
    } catch (error) {
      attempt += 1;
      if (!isRetryableApiError(error) || attempt > config.commandResultRetries) {
        pendingResults.push({ commandId, payload });
        if (pendingResults.length > 50) pendingResults.shift();
        throw error;
      }
      log('warn', `Result report for ${commandId} failed (attempt ${attempt}), retrying...`);
      await sleep(backoffDelayMs(attempt, 1000, 15_000));
    }
  }
}

/** Flush queued command results from earlier offline periods. */
async function flushPendingResults(activeState: AgentState): Promise<void> {
  while (pendingResults.length > 0 && !shuttingDown) {
    const item = pendingResults[0]!;
    try {
      await reportCommandResult(activeState.agentToken, item.commandId, item.payload);
      pendingResults.shift();
      log('info', `Flushed queued result for command ${item.commandId}`);
    } catch (error) {
      if (!isRetryableApiError(error)) pendingResults.shift();
      break;
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
    // Each collector is isolated so one failing sensor (e.g. AV WMI
    // namespace missing) still sends the remaining inventory instead of
    // dropping the whole heartbeat.
    const [info, apps, sec, hotfixes] = await Promise.all([
      collectSystemInfo().catch((e) => {
        log('warn', `System inventory collection failed: ${(e as Error).message}`);
        return null;
      }),
      collectInstalledSoftware().catch((e) => {
        log('warn', `Software inventory collection failed: ${(e as Error).message}`);
        return null;
      }),
      collectSecurityState().catch((e) => {
        log('warn', `Security state collection failed: ${(e as Error).message}`);
        return null;
      }),
      collectInstalledPatches().catch((e) => {
        log('warn', `Patch inventory collection failed: ${(e as Error).message}`);
        return null;
      }),
    ]);
    // Partial-failure safe: a failed collector sends `undefined` (skipped
    // server-side) instead of an empty list, so a broken sensor never wipes
    // the server's stored inventory. Hardware failure degrades to a
    // lightweight heartbeat; telemetry is retried next cycle.
    if (!info) {
      log('warn', 'System inventory unavailable; sending lightweight heartbeat this cycle');
    }
    hardware = info ?? undefined;
    software = apps ?? undefined;
    security = sec ?? undefined;
    patches = hotfixes ?? undefined;
    log(
      'info',
      `Telemetry collected: ${software ? `${software.length} applications` : 'software skipped'}, ${patches ? `${patches.length} hotfixes` : 'patches skipped'}, firewall=${security?.firewallEnabled ?? 'unknown'}, antivirus=${security?.antivirusEnabled ?? 'unknown'}`,
    );
  }

  const response = await sendHeartbeat(state.agentToken, state.deviceId, {
    hardware,
    software,
    security,
    patches,
  });

  consecutiveFailures = 0;
  lastSuccessfulHeartbeatAt = Date.now();
  log(
    'info',
    `Heartbeat OK: device=${response.device.status}, pendingCommands=${response.pendingCommands.length}`,
  );

  // Only advance the telemetry clock when hardware (the anchor for an
  // inventory snapshot) was actually collected. Otherwise keep
  // forceTelemetry so the next cycle retries a full sync (network recovery).
  if (includeTelemetry && hardware) {
    lastTelemetryAt = Date.now();
    forceTelemetry = false;
  } else if (includeTelemetry) {
    forceTelemetry = true;
  }

  await flushPendingResults(state);

  if (response.pendingCommands.length > 0) {
    await processCommands(state, response.pendingCommands);
  }
}

function scheduleNext(delayMs: number): void {
  if (shuttingDown) return;
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = setTimeout(() => void loop(), delayMs);
}

async function loop(): Promise<void> {
  const activeState = state;
  if (!activeState || enrolling || shuttingDown) {
    scheduleNext(config.heartbeatIntervalMs);
    return;
  }

  try {
    const includeTelemetry =
      forceTelemetry || Date.now() - lastTelemetryAt >= config.telemetryIntervalMs;
    await heartbeat(activeState, includeTelemetry);
    scheduleNext(config.heartbeatIntervalMs);
  } catch (error) {
    if (error instanceof AgentApiError && REENROLL_CODES.has(error.code)) {
      startEnrollment(`Saved agent credentials were rejected (${error.code})`);
      scheduleNext(config.heartbeatIntervalMs);
      return;
    }
    consecutiveFailures += 1;
    const retryable = isRetryableApiError(error);
    // Exponential backoff with jitter keeps the agent from hammering a
    // struggling API while still recovering quickly from blips. Telemetry is
    // forced on the next success after failures so the server gets a fresh
    // inventory snapshot once connectivity returns.
    const delay = retryable
      ? backoffDelayMs(consecutiveFailures)
      : config.heartbeatIntervalMs;
    if (retryable && consecutiveFailures >= 2) forceTelemetry = true;
    const offlineFor = lastSuccessfulHeartbeatAt ? ` (no success for ${Math.round((Date.now() - lastSuccessfulHeartbeatAt) / 1000)}s)` : '';
    log('error', `Heartbeat failed (attempt ${consecutiveFailures})${offlineFor}: ${(error as Error).message}. Retrying in ${Math.round(delay / 1000)}s.`);
    scheduleNext(delay);
  }
}

async function promptForEnrollmentToken(force = false): Promise<void> {
  if ((!force && config.enrollmentToken) || !input.isTTY || !output.isTTY) return;
  console.clear();
  printBanner();
  console.log('\nThis one-time setup connects this Windows device to your RicozEndpoint organization.');
  console.log(`${colors.dim}Paste the enrollment token from the admin console below.${colors.reset}\n`);
  const readline = createInterface({ input, output });
  try {
    const token = (await readline.question('Paste enrollment token: ')).trim();
    if (!token) throw new Error('Enrollment token cannot be empty.');
    config.enrollmentToken = token;
  } finally {
    readline.close();
  }
}

function startEnrollment(reason: string): void {
  if (enrolling) return;

  const interactive = input.isTTY && output.isTTY;
  if (!interactive && !config.enrollmentToken) {
    log('error', `${reason}, and ENROLLMENT_TOKEN is not configured for noninteractive use.`);
    process.exit(1);
    return;
  }

  enrolling = true;
  clearState(config.agentStateFile);
  state = null;
  if (interactive) config.enrollmentToken = '';
  log('warn', `${reason}. Starting enrollment...`);

  let shouldPrompt = interactive;
  const attempt = async (retryCount = 0): Promise<void> => {
    if (shuttingDown) return;
    try {
      if (shouldPrompt) {
        config.enrollmentToken = '';
        await promptForEnrollmentToken(true);
        shouldPrompt = false;
      } else if (!config.enrollmentToken) {
        await promptForEnrollmentToken();
      }
      if (!config.enrollmentToken) {
        throw new Error('No enrollment token is available.');
      }

      state = await enroll();
      enrolling = false;
      consecutiveFailures = 0;
      lastTelemetryAt = 0;
      forceTelemetry = true;
      log('info', 'Enrollment complete; device telemetry will be sent on the next heartbeat.');
      scheduleNext(1000);
    } catch (error) {
      if (shuttingDown) return;
      if (error instanceof AgentApiError && INVALID_ENROLLMENT_CODES.has(error.code)) {
        log('error', `Enrollment token rejected: ${error.message}`);
        if (!interactive) {
          log('error', 'Provide a fresh ENROLLMENT_TOKEN and restart the agent.');
          process.exit(1);
          return;
        }
        config.enrollmentToken = '';
        shouldPrompt = true;
        void attempt();
        return;
      }
      const delay = backoffDelayMs(retryCount, 10_000, 300_000);
      log('error', `Enrollment failed: ${(error as Error).message}`);
      log('warn', `Retrying enrollment automatically in ${Math.round(delay / 1000)}s...`);
      setTimeout(() => void attempt(retryCount + 1), delay);
    }
  };

  void attempt();
}

function installShutdownHandlers(): void {
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (loopTimer) clearTimeout(loopTimer);
    log('warn', `Received ${signal}; agent shutting down gracefully (${pendingResults.length} queued result(s) preserved in memory).`);
    // Queued results are best-effort in-memory; state file already holds identity.
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main(): Promise<void> {
  if (input.isTTY && output.isTTY) printBanner();

  if (!config.apiUrl) {
    log('error', 'API_URL is not configured');
    process.exit(1);
  }

  installShutdownHandlers();

  log('info', `Agent ${config.agentVersion} starting (api=${config.apiUrl})`);
  log(
    'info',
    `Heartbeat every ${Math.round(config.heartbeatIntervalMs / 1000)}s, telemetry every ${Math.round(config.telemetryIntervalMs / 1000)}s, request timeout ${Math.round(config.requestTimeoutMs / 1000)}s.`,
  );

  state = loadState(config.agentStateFile);

  if (!state) {
    startEnrollment('No saved device credentials');
  } else {
    log('info', `Loaded saved device credentials. Heartbeat every ${Math.round(config.heartbeatIntervalMs / 1000)} seconds.`);
  }

  if (state) {
    // Fresh inventory snapshot on every (re)start so the server recovers an
    // accurate baseline after offline periods, restarts, or updates.
    lastTelemetryAt = 0;
    forceTelemetry = true;
  }
  setTimeout(() => void loop(), 1000);
}

main().catch((error) => {
  log('error', `Fatal: ${(error as Error).stack ?? (error as Error).message}`);
  process.exit(1);
});