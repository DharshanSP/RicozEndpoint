import { execFile } from 'node:child_process';
import { fetchPolicies } from './api';

export type CommandOutcome = { status: 'COMPLETED'; result: string } | { status: 'FAILED'; errorMessage: string };

export interface CommandExecutionContext {
  agentToken?: string;
  params?: Record<string, unknown>;
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

function runPowerShell(script: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
}

/**
 * Download and install a single Windows update matching the given KB article
 * through the Windows Update Agent COM API. The installer is configured to
 * never force a reboot; a reboot-required outcome is reported back instead.
 */
async function installWindowsUpdate(kbNumber: string): Promise<string> {
  const script = `
$ErrorActionPreference = 'Stop'
$kb = '${kbNumber}'
$already = @(Get-HotFix -ErrorAction SilentlyContinue | Where-Object { $_.HotFixId -ieq $kb })
if ($already.Count -gt 0) {
  Write-Output "ALREADY_INSTALLED:$($already[0].Description)"
  exit 0
}
$session = New-Object -ComObject Microsoft.Update.Session
$searcher = $session.CreateUpdateSearcher()
$found = $searcher.Search('IsInstalled=0 and IsHidden=0')
$target = $null
foreach ($u in @($found.Updates)) {
  foreach ($id in @($u.KBArticleIDs)) {
    if ($id -ieq $kb) { $target = $u; break }
  }
  if ($target) { break }
}
if (-not $target) {
  Write-Output "NOT_AVAILABLE:$kb"
  exit 0
}
if (-not $target.EulaAccepted) { [void]$target.AcceptEulas() }
if (-not $target.IsDownloaded) {
  $downloader = $session.CreateUpdateDownloader()
  $dcoll = $session.CreateUpdateCollection()
  [void]$dcoll.Add($target)
  $downloader.Updates = $dcoll
  [void]$downloader.Download()
}
$installer = $session.CreateUpdateInstaller()
$icoll = $session.CreateUpdateCollection()
[void]$icoll.Add($target)
$installer.Updates = $icoll
$installer.AllowForceReboot = $false
$result = $installer.Install()
$outcome = switch ($result.ResultCode) {
  2 { 'Succeeded' }
  3 { 'SucceededWithErrors' }
  4 { 'Failed' }
  5 { 'Aborted' }
  default { "ResultCode $($result.ResultCode)" }
}
$reboot = if ($result.RebootRequired) { 'reboot-required' } else { 'no-reboot' }
Write-Output "$outcome|$reboot|$($target.Title)"
`;

  const raw = await runPowerShell(script, 600_000);
  const line = raw.split(/\r?\n/).filter(Boolean).pop() ?? '';

  if (line.startsWith('ALREADY_INSTALLED:')) {
    return `${kbNumber} is already installed`;
  }
  if (line.startsWith('NOT_AVAILABLE:')) {
    throw new Error(`${kbNumber} was not offered by Windows Update on this device`);
  }
  if (!line) {
    throw new Error(`${kbNumber} install produced no output from Windows Update Agent`);
  }

  const [state, reboot, title] = line.split('|');
  if (state === 'Succeeded' || state === 'SucceededWithErrors') {
    return `${kbNumber} installed (${state}, ${reboot ?? 'no-reboot'}): ${title ?? ''}`.trim();
  }
  throw new Error(`${kbNumber} install did not succeed: ${line}`);
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
    case 'INSTALL_PATCH': {
      const kb = context.params?.kbNumber;
      if (typeof kb !== 'string' || !/^KB\d+$/i.test(kb)) {
        return {
          status: 'FAILED',
          errorMessage: 'INSTALL_PATCH requires params.kbNumber in the form KB1234567',
        };
      }
      try {
        const result = await installWindowsUpdate(kb.toUpperCase());
        return { status: 'COMPLETED', result };
      } catch (error) {
        return { status: 'FAILED', errorMessage: (error as Error).message };
      }
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