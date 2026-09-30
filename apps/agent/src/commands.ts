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

/** Exit codes that mean "it worked" for Windows installers (0, reboot requested, MSI not-found). */
const INSTALLER_SUCCESS_CODES = [0, 1605, 1614, 1641, 3010];

/** Escape a value for embedding inside a single-quoted PowerShell literal. */
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function lastLine(output: string): string {
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).pop() ?? '';
}

/**
 * Download an http(s) package and install it silently.
 * Supports .msi, .exe and .msu installers; `silentArgs` is appended verbatim
 * so the administrator controls vendor-specific switches.
 */
async function installApplication(params: Record<string, unknown>): Promise<string> {
  const url = typeof params.installerUrl === 'string' ? params.installerUrl.trim() : '';
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('INSTALL_APPLICATION requires params.installerUrl to be an http(s) URL');
  }
  const silentArgs = typeof params.silentArgs === 'string' ? params.silentArgs.trim() : '';

  const script = `
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
try {
  $url = ${psQuote(url)}
  $silentArgs = ${psQuote(silentArgs)}
  $dir = Join-Path $env:TEMP 'ricoz-deploy'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $name = ''
  try { $name = [IO.Path]::GetFileName(([Uri]$url).LocalPath) } catch { $name = '' }
  if ([string]::IsNullOrWhiteSpace($name)) { $name = 'ricoz-package.bin' }
  $path = Join-Path $dir $name
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
  Invoke-WebRequest -Uri $url -OutFile $path -UseBasicParsing -TimeoutSec 540
  if (-not (Test-Path -LiteralPath $path)) { throw 'Download did not produce a package file' }
  $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($ext -notin @('.msi', '.exe', '.msu')) {
    Write-Output ('UNSUPPORTED:' + $ext)
  } else {
    $exitCode = -1
    if ($ext -eq '.msi') {
      $argList = '/i "' + $path + '" /qn /norestart'
      if ($silentArgs) { $argList = $argList + ' ' + $silentArgs }
      $exitCode = (Start-Process -FilePath 'msiexec.exe' -ArgumentList $argList -Wait -PassThru).ExitCode
    } elseif ($ext -eq '.msu') {
      $argList = '"' + $path + '" /quiet /norestart'
      $exitCode = (Start-Process -FilePath 'wusa.exe' -ArgumentList $argList -Wait -PassThru).ExitCode
    } else {
      if ($silentArgs) {
        $exitCode = (Start-Process -FilePath $path -ArgumentList $silentArgs -Wait -PassThru).ExitCode
      } else {
        $exitCode = (Start-Process -FilePath $path -Wait -PassThru).ExitCode
      }
    }
    if ($exitCode -eq $null) { $exitCode = -1 }
    if (@(${INSTALLER_SUCCESS_CODES.join(', ')}) -contains $exitCode) {
      Write-Output ('INSTALLED:' + $ext + '|' + $exitCode)
    } else {
      Write-Output ('FAILED:installer for ' + $name + ' exited with code ' + $exitCode)
    }
  }
} catch {
  Write-Output ('FAILED:' + $_.Exception.Message)
}
`;

  const line = lastLine(await runPowerShell(script, 600_000));

  if (line.startsWith('UNSUPPORTED:')) {
    throw new Error(
      `Unsupported package type "${line.slice('UNSUPPORTED:'.length)}"; supply an .msi, .exe or .msu package`
    );
  }
  if (line.startsWith('FAILED:')) {
    throw new Error(line.slice('FAILED:'.length));
  }
  if (line.startsWith('INSTALLED:')) {
    const [, ext, exitCode] = line.split('|');
    const name = typeof params.name === 'string' ? params.name : 'Application';
    return `${name} installed successfully (${ext} package, exit code ${exitCode ?? '0'})`;
  }
  throw new Error(`Install produced no recognisable result: ${line || 'no output'}`);
}

/**
 * Uninstall a product by its registered DisplayName. MSI products are removed
 * through msiexec; everything else runs its registered UninstallString with the
 * administrator-supplied silent switches.
 */
async function uninstallApplication(params: Record<string, unknown>): Promise<string> {
  const name = typeof params.name === 'string' ? params.name.trim() : '';
  if (!name) {
    throw new Error('UNINSTALL_APPLICATION requires params.name');
  }
  const silentArgs = typeof params.silentArgs === 'string' ? params.silentArgs.trim() : '';

  const script = `
$ErrorActionPreference = 'Stop'
try {
  $name = ${psQuote(name)}
  $silentArgs = ${psQuote(silentArgs)}
  $roots = @(
    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
  )
  $found = @(Get-ItemProperty -Path $roots -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -and ($_.DisplayName -ieq $name) })
  if ($found.Count -eq 0) {
    Write-Output ('NOT_FOUND:' + $name)
  } else {
    $entry = $found[0]
    $child = [string]$entry.PSChildName
    $isMsi = $child -match '^[{][0-9A-Fa-f-]{36}[}]$'
    $exitCode = -1
    if ($isMsi) {
      $argList = '/x ' + $child + ' /qn /norestart'
      if ($silentArgs) { $argList = $argList + ' ' + $silentArgs }
      $exitCode = (Start-Process -FilePath 'msiexec.exe' -ArgumentList $argList -Wait -PassThru).ExitCode
    } elseif ($entry.UninstallString) {
      $raw = [string]$entry.UninstallString
      $exe = $raw
      $argStr = ''
      if ($raw -match '^\s*"([^"]+)"\s*(.*)$') { $exe = $Matches[1]; $argStr = $Matches[2] }
      elseif ($raw -match '^\s*(\S+)\s*(.*)$') { $exe = $Matches[1]; $argStr = $Matches[2] }
      if ($silentArgs) {
        if ($argStr) { $argStr = $argStr + ' ' + $silentArgs } else { $argStr = $silentArgs }
      }
      if ($argStr) {
        $exitCode = (Start-Process -FilePath $exe -ArgumentList $argStr -Wait -PassThru).ExitCode
      } else {
        $exitCode = (Start-Process -FilePath $exe -Wait -PassThru).ExitCode
      }
    } else {
      Write-Output ('FAILED:' + $name + ' has no registered UninstallString')
      $exitCode = $null
    }
    if ($exitCode -ne $null) {
      if (@(${INSTALLER_SUCCESS_CODES.join(', ')}) -contains $exitCode) {
        Write-Output ('UNINSTALLED:' + $exitCode)
      } else {
        Write-Output ('FAILED:uninstall of ' + $name + ' exited with code ' + $exitCode)
      }
    }
  }
} catch {
  Write-Output ('FAILED:' + $_.Exception.Message)
}
`;

  const line = lastLine(await runPowerShell(script, 600_000));

  if (line.startsWith('NOT_FOUND:')) {
    throw new Error(`${name} is not installed on this device`);
  }
  if (line.startsWith('FAILED:')) {
    throw new Error(line.slice('FAILED:'.length));
  }
  if (line.startsWith('UNINSTALLED:')) {
    return `${name} uninstalled (exit code ${line.slice('UNINSTALLED:'.length)})`;
  }
  throw new Error(`Uninstall produced no recognisable result: ${line || 'no output'}`);
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
    case 'INSTALL_APPLICATION':
      try {
        return { status: 'COMPLETED', result: await installApplication(context.params ?? {}) };
      } catch (error) {
        return { status: 'FAILED', errorMessage: (error as Error).message };
      }
    case 'UNINSTALL_APPLICATION':
      try {
        return { status: 'COMPLETED', result: await uninstallApplication(context.params ?? {}) };
      } catch (error) {
        return { status: 'FAILED', errorMessage: (error as Error).message };
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