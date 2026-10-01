import { config } from './config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadState, saveState, type AgentState } from './state';
import { collectInstalledPatches, collectInstalledSoftware, collectSecurityState, collectSystemInfo } from './inventory';
import { AgentApiError, enrollDevice, reportCommandResult, sendHeartbeat } from './api';
import { executeCommand } from './commands';
import type { PendingCommand } from './api';

const startedAt = Date.now();
let lastTelemetryAt = 0;
let forceTelemetry = false;

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

async function promptForEnrollmentToken(): Promise<void> {
  if (config.enrollmentToken || !input.isTTY) return;
  console.clear();
  printBanner();
  console.log('\nThis one-time setup connects this Windows device to your RicozEndpoint organization.');
  console.log(`${colors.dim}Paste the enrollment token from the admin console below.${colors.reset}\n`);
  const readline = createInterface({ input, output });
  try {
    config.enrollmentToken = (await readline.question('Paste enrollment token: ')).trim();
  } finally {
    readline.close();
  }
}

async function main(): Promise<void> {
  if (input.isTTY && output.isTTY) printBanner();

  if (!config.apiUrl) {
    log('error', 'API_URL is not configured');
    process.exit(1);
  }

  log('info', `Agent ${config.agentVersion} starting`);

  let state = loadState(config.agentStateFile);

  if (!state) {
    await promptForEnrollmentToken();
    if (!config.enrollmentToken) {
      log('error', 'No credentials cached and ENROLLMENT_TOKEN is not set. Refusing to start.');
      process.exit(1);
    }
    const enrollLoop = async (): Promise<void> => {
      try {
        state = await enroll();
      } catch (error) {
        log('error', `Enrollment failed: ${(error as Error).message}`);
        log('warn', 'Retrying automatically in 30 seconds...');
        setTimeout(() => void enrollLoop(), 30_000);
      }
    };
    await enrollLoop();
    if (!state) {
      return;
    }
  }

  lastTelemetryAt = startedAt;
  log('info', `Connected. Heartbeat every ${Math.round(config.heartbeatIntervalMs / 1000)} seconds.`);
  const activeState = state;
  setTimeout(() => void loop(activeState), 1000);
}

main().catch((error) => {
  log('error', `Fatal: ${(error as Error).stack ?? (error as Error).message}`);
  process.exit(1);
});