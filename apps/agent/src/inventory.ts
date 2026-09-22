import { execFile } from 'node:child_process';

export interface SystemInfo {
  hostname: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  os: string;
  osVersion: string;
  architecture: string;
  ipAddress: string;
  cpu: string;
  cpuCores: number;
  ramBytes: number;
  storageBytes: number;
  biosVersion: string;
}

export interface SoftwareItem {
  name: string;
  version: string;
  publisher: string;
  installDate: string | null;
  architecture: string;
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 45_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
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

/** Collect OS / host / CPU / memory / disk summary via WMI/CIM. */
export async function collectSystemInfo(): Promise<SystemInfo> {
  const script = `
$ErrorActionPreference = 'Stop'
$cs = Get-CimInstance Win32_ComputerSystem
$os = Get-CimInstance Win32_OperatingSystem
$bios = Get-CimInstance Win32_BIOS
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$ram = [double]$cs.TotalPhysicalMemory
$disk = [double](Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Measure-Object -Property Size -Sum).Sum
$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '0.0.0.0' } | Select-Object -First 1
$result = [pscustomobject]@{
  hostname = [string]$cs.Name
  serialNumber = [string]$bios.SerialNumber
  manufacturer = [string]$cs.Manufacturer
  model = [string]$cs.Model
  os = [string]$os.Caption
  osVersion = ("{0} {1}" -f $os.Caption, $os.Version)
  architecture = [string]$os.OSArchitecture
  ipAddress = if ($ip) { [string]$ip.IPAddress } else { '' }
  cpu = [string]$cpu.Name
  cpuCores = [int]$cpu.NumberOfCores
  ramBytes = [long]$ram
  storageBytes = [long]$disk
  biosVersion = [string]$bios.SMBIOSBIOSVersion
}
$result | ConvertTo-Json -Compress
`;

  const raw = await runPowerShell(script);
  const parsed = JSON.parse(raw) as SystemInfo;
  if (!parsed.hostname || !parsed.serialNumber) {
    throw new Error(`Inventory collection returned incomplete data: ${raw.slice(0, 200)}`);
  }
  return parsed;
}

/** Enumerate installed applications from the registry uninstall keys. */
export async function collectInstalledSoftware(): Promise<SoftwareItem[]> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$paths = @(
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
$items = foreach ($p in $paths) {
  Get-ItemProperty $p | Where-Object { $_.DisplayName -and $_.DisplayName -notmatch '^\\{.*\\}$' } | ForEach-Object {
    $install = $null
    if ($_.InstallDate -match '^\\d{8}$') {
      try { $install = [datetime]::ParseExact($_.InstallDate, 'yyyyMMdd', $null).ToString('o') } catch { $install = $null }
    }
    [pscustomobject]@{
      name = [string]$_.DisplayName
      version = [string]$_.DisplayVersion
      publisher = [string]$_.Publisher
      installDate = $install
      architecture = if ($p -like '*WOW6432Node*') { 'x86' } else { 'x64' }
    }
  }
}
@($items | Sort-Object name) | ConvertTo-Json -Compress
`;

  const raw = await runPowerShell(script);
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as SoftwareItem[] | SoftwareItem;
  return Array.isArray(parsed) ? parsed : [parsed];
}