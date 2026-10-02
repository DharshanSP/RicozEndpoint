import { config } from './config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { clearState, loadState, saveState, type AgentState } from './state';
import { collectInstalledPatches, collectInstalledSoftware, collectSecurityState, collectSystemInfo } from './inventory';
import { AgentApiError, enrollDevice, reportCommandResult, sendHeartbeat } from './api';
import { executeCommand } from './commands';
import type { PendingCommand } from './api';

const startedAt = Date.now();
let lastTelemetryAt = 0;
let forceTelemetry = false;
let state: AgentState | null = null;
let enrolling = false;

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
      startEnrollment(`Saved agent credentials were rejected (${error.code})`);
    } else {
      log('error', `Heartbeat failed: ${(error as Error).message}`);
    }
  } finally {
    setTimeout(() => void loop(), config.heartbeatIntervalMs);
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
  const attempt = async (): Promise<void> => {
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
      lastTelemetryAt = 0;
      forceTelemetry = true;
      log('info', 'Enrollment complete; device telemetry will be sent on the next heartbeat.');
    } catch (error) {
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
      log('error', `Enrollment failed: ${(error as Error).message}`);
      log('warn', 'Retrying automatically in 30 seconds...');
      setTimeout(() => void attempt(), 30_000);
    }
  };

  void attempt();
}

async function main(): Promise<void> {
  if (input.isTTY && output.isTTY) printBanner();

  if (!config.apiUrl) {
    log('error', 'API_URL is not configured');
    process.exit(1);
  }

  log('info', `Agent ${config.agentVersion} starting (api=${config.apiUrl})`);

  state = loadState(config.agentStateFile);

  if (!state) {
    startEnrollment('No saved device credentials');
  } else {
    log('info', `Loaded saved device credentials. Heartbeat every ${Math.round(config.heartbeatIntervalMs / 1000)} seconds.`);
  }

  if (state) lastTelemetryAt = startedAt;
  setTimeout(() => void loop(), 1000);
}

main().catch((error) => {
  log('error', `Fatal: ${(error as Error).stack ?? (error as Error).message}`);
  process.exit(1);
});