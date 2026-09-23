import { execFile } from 'node:child_process';
import { fetchPolicies } from './api';

export type CommandOutcome = { status: 'COMPLETED'; result: string } | { status: 'FAILED'; errorMessage: string };

export interface CommandExecutionContext {
  agentToken?: string;
}

function runProgram(program: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(program, args, { timeout: 15_000, windowsHide: true }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/**
 * Execute a platform command on the local Windows host.
 * Lightweight commands run inline; heavier ones (restart, shutdown) are
 * scheduled via the Windows shutdown utility.
 */
export async function executeCommand(commandType: string, context: CommandExecutionContext = {}): Promise<CommandOutcome> {
  switch (commandType) {
    case 'REFRESH_INVENTORY':
      return { status: 'COMPLETED', result: 'Inventory refresh queued for next heartbeat' };
    case 'SYNC_POLICY':
      if (!context.agentToken) {
        return { status: 'FAILED', errorMessage: 'Policy sync requires an authenticated agent session' };
      }
      try {
        const sync = await fetchPolicies(context.agentToken);
        const summary = sync.policies
          .map((policy) => `${policy.name}(${policy.type})`)
          .join(', ');
        return {
          status: 'COMPLETED',
          result: `Synced ${sync.policies.length} policies (hash ${sync.contentHash.slice(0, 12)}...)${summary ? `: ${summary}` : ''}`,
        };
      } catch (error) {
        return { status: 'FAILED', errorMessage: `Policy sync failed: ${(error as Error).message}` };
      }
    case 'LOCK_DEVICE':
      try {
        await runProgram('rundll32.exe', ['user32.dll,LockWorkStation']);
        return { status: 'COMPLETED', result: 'Workstation locked' };
      } catch (error) {
        return { status: 'FAILED', errorMessage: `Failed to lock workstation: ${(error as Error).message}` };
      }
    case 'RESTART_DEVICE':
      try {
        await runProgram('shutdown.exe', ['/r', '/t', '10', '/c', 'RicozEndpoint: administrator-requested restart']);
        return { status: 'COMPLETED', result: 'Restart scheduled in 10 seconds' };
      } catch (error) {
        return { status: 'FAILED', errorMessage: `Failed to schedule restart: ${(error as Error).message}` };
      }
    case 'SHUTDOWN_DEVICE':
      try {
        await runProgram('shutdown.exe', ['/s', '/t', '10', '/c', 'RicozEndpoint: administrator-requested shutdown']);
        return { status: 'COMPLETED', result: 'Shutdown scheduled in 10 seconds' };
      } catch (error) {
        return { status: 'FAILED', errorMessage: `Failed to schedule shutdown: ${(error as Error).message}` };
      }
    default:
      return { status: 'FAILED', errorMessage: `Unsupported command type: ${commandType}` };
  }
}