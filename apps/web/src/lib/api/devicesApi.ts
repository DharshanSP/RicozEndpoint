import {
  DeviceFilterParams,
  DeviceListApiResponse,
  DeviceDetailApiResponse,
} from '../../types/device';
import { mockDevices } from '../../mocks/deviceData';

/**
 * ============================================================================
 * BACKEND API CONTRACT SPECIFICATION (For Dharshan)
 * ============================================================================
 *
 * 1. LIST DEVICES
 * Endpoint: GET /api/devices
 * Query Params:
 *   - search?: string (filters deviceName, hostname, serialNumber, ipAddress)
 *   - status?: 'ONLINE' | 'OFFLINE' | 'PENDING'
 *   - os?: 'Windows' | 'macOS' | 'Linux'
 *   - manufacturer?: string
 *   - sortBy?: 'deviceName' | 'status' | 'os' | 'lastSeenAt' | 'registeredAt' (default: 'lastSeenAt')
 *   - sortOrder?: 'asc' | 'desc' (default: 'desc')
 *   - page?: number (default: 1)
 *   - pageSize?: number (default: 10)
 * Headers: Authorization: Bearer <jwt_token>
 *
 * Expected JSON Response Shape:
 * {
 *   "success": true,
 *   "data": {
 *     "devices": Device[],
 *     "pagination": {
 *       "page": 1,
 *       "pageSize": 10,
 *       "total": 24,
 *       "totalPages": 3
 *     },
 *     "metrics": {
 *       "totalDevices": 24,
 *       "onlineDevices": 21,
 *       "offlineDevices": 2,
 *       "pendingDevices": 1
 *     }
 *   }
 * }
 *
 * 2. GET SINGLE DEVICE DETAILS
 * Endpoint: GET /api/devices/:id
 * Headers: Authorization: Bearer <jwt_token>
 *
 * Expected JSON Response Shape:
 * {
 *   "success": true,
 *   "data": Device (including relations: hardware, software, policies, heartbeats, complianceResults, commands, alerts)
 * }
 * ============================================================================
 */

/**
 * Fetches the paginated list of organization endpoints with optional filtering and sorting.
 *
 * @param params - Filter, sorting, and pagination parameters
 * @returns Promise resolving to the paginated device dataset and fleet metrics
 */
export async function getDevices(params: DeviceFilterParams = {}): Promise<DeviceListApiResponse> {
  // Simulate realistic network delay for async loading transitions
  await new Promise((resolve) => setTimeout(resolve, 200));

  // ==========================================================================
  // TODO (Dharshan): When GET /api/devices endpoint is implemented in Fastify,
  // uncomment the real API call below and remove the client-side mock filtering:
  //
  // const query = new URLSearchParams();
  // if (params.search) query.set('search', params.search);
  // if (params.status) query.set('status', params.status);
  // if (params.os) query.set('os', params.os);
  // if (params.manufacturer) query.set('manufacturer', params.manufacturer);
  // if (params.sortBy) query.set('sortBy', params.sortBy);
  // if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  // if (params.page) query.set('page', params.page.toString());
  // if (params.pageSize) query.set('pageSize', params.pageSize.toString());
  //
  // return fetchApi<DeviceListResponseData>(`/devices?${query.toString()}`);
  // ==========================================================================

  // Calculate overall fleet metrics derived dynamically from full mock dataset
  const metrics = {
    totalDevices: mockDevices.length,
    onlineDevices: mockDevices.filter((d) => d.status.toUpperCase() === 'ONLINE').length,
    offlineDevices: mockDevices.filter((d) => d.status.toUpperCase() === 'OFFLINE').length,
    pendingDevices: mockDevices.filter((d) => d.status.toUpperCase() === 'PENDING').length,
  };

  let filtered = [...mockDevices];

  // 1. Text Search Filter
  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    filtered = filtered.filter(
      (d) =>
        d.deviceName.toLowerCase().includes(q) ||
        d.hostname.toLowerCase().includes(q) ||
        d.serialNumber.toLowerCase().includes(q) ||
        d.ipAddress.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        d.manufacturer.toLowerCase().includes(q)
    );
  }

  // 2. Status Filter
  if (params.status && params.status !== 'ALL') {
    filtered = filtered.filter(
      (d) => d.status.toUpperCase() === params.status?.toUpperCase()
    );
  }

  // 3. OS Filter
  if (params.os && params.os !== 'ALL') {
    filtered = filtered.filter(
      (d) => d.os.toLowerCase() === params.os?.toLowerCase()
    );
  }

  // 4. Manufacturer Filter
  if (params.manufacturer && params.manufacturer !== 'ALL') {
    filtered = filtered.filter(
      (d) => d.manufacturer.toLowerCase() === params.manufacturer?.toLowerCase()
    );
  }

  // 5. Sorting
  const sortBy = params.sortBy || 'lastSeenAt';
  const sortOrder = params.sortOrder || 'desc';

  filtered.sort((a, b) => {
    let valA: string | number | null = null;
    let valB: string | number | null = null;

    if (sortBy === 'deviceName') {
      valA = a.deviceName.toLowerCase();
      valB = b.deviceName.toLowerCase();
    } else if (sortBy === 'status') {
      valA = a.status.toLowerCase();
      valB = b.status.toLowerCase();
    } else if (sortBy === 'os') {
      valA = `${a.os} ${a.osVersion}`.toLowerCase();
      valB = `${b.os} ${b.osVersion}`.toLowerCase();
    } else if (sortBy === 'registeredAt') {
      valA = new Date(a.registeredAt).getTime();
      valB = new Date(b.registeredAt).getTime();
    } else {
      // Default: lastSeenAt
      valA = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      valB = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // 6. Pagination
  const page = Math.max(1, params.page || 1);
  const pageSize = params.pageSize || 10;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedDevices = filtered.slice(startIndex, startIndex + pageSize);

  return {
    success: true,
    data: {
      devices: paginatedDevices,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      metrics,
    },
  };
}

/**
 * Generates rich, realistic relational mock data tailored to the device's OS and specifications.
 */
function enrichDeviceWithRelations(device: Device): Device {
  const isWin = device.os.toLowerCase().includes('win');
  const isMac = device.os.toLowerCase().includes('mac');

  // 1. Hardware Fallback
  const hardware = device.hardware || {
    id: `hw-${device.id}`,
    deviceId: device.id,
    cpu: isWin
      ? '13th Gen Intel(R) Core(TM) i7-1365U @ 1.80GHz'
      : isMac
      ? 'Apple M3 Pro (12-Core CPU, 18-Core GPU)'
      : 'AMD Ryzen 7 PRO 7840U (8 Cores, 16 Threads)',
    cpuCores: isWin ? 10 : isMac ? 12 : 8,
    ramBytes: isWin ? 34359738368 : isMac ? 19327352832 : 34359738368,
    storageBytes: 1000204886016, // 1 TB NVMe
    manufacturer: device.manufacturer || (isMac ? 'Apple Inc.' : 'Dell Inc.'),
    model: device.model || (isMac ? 'Mac15,6' : 'Latitude 7440'),
    serialNumber: device.serialNumber,
    biosVersion: isWin ? 'Dell 1.8.2 (UEFI)' : isMac ? 'iBoot-10151.81.1' : 'Lenovo N3MET12W',
    createdAt: device.registeredAt,
    updatedAt: device.updatedAt,
  };

  // 2. Software Inventory
  const software = device.software && device.software.length > 0 ? device.software : (
    isWin
      ? [
          { id: `sw-1-${device.id}`, deviceId: device.id, name: 'Ricoz Endpoint Agent', version: '0.1.0', publisher: 'Ricoz Security', installDate: '2026-01-15T08:30:00Z', architecture: 'x86_64', createdAt: '2026-01-15T08:30:00Z', updatedAt: '2026-01-15T08:30:00Z' },
          { id: `sw-2-${device.id}`, deviceId: device.id, name: 'Google Chrome', version: '122.0.6261.94', publisher: 'Google LLC', installDate: '2026-01-15T09:00:00Z', architecture: 'x86_64', createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-01-15T09:00:00Z' },
          { id: `sw-3-${device.id}`, deviceId: device.id, name: 'Microsoft 365 Apps for Enterprise', version: '16.0.17328.20142', publisher: 'Microsoft Corporation', installDate: '2026-01-15T09:10:00Z', architecture: 'x86_64', createdAt: '2026-01-15T09:10:00Z', updatedAt: '2026-01-15T09:10:00Z' },
          { id: `sw-4-${device.id}`, deviceId: device.id, name: 'CrowdStrike Falcon Sensor', version: '7.11.18004.0', publisher: 'CrowdStrike Inc.', installDate: '2026-01-15T08:35:00Z', architecture: 'x86_64', createdAt: '2026-01-15T08:35:00Z', updatedAt: '2026-01-15T08:35:00Z' },
          { id: `sw-5-${device.id}`, deviceId: device.id, name: 'Slack Enterprise Grid', version: '4.36.140', publisher: 'Slack Technologies', installDate: '2026-01-16T11:20:00Z', architecture: 'x86_64', createdAt: '2026-01-16T11:20:00Z', updatedAt: '2026-01-16T11:20:00Z' },
          { id: `sw-6-${device.id}`, deviceId: device.id, name: 'Visual Studio Code', version: '1.87.0', publisher: 'Microsoft Corporation', installDate: '2026-01-17T14:15:00Z', architecture: 'x86_64', createdAt: '2026-01-17T14:15:00Z', updatedAt: '2026-01-17T14:15:00Z' },
          { id: `sw-7-${device.id}`, deviceId: device.id, name: 'Zoom Workplace', version: '5.17.11', publisher: 'Zoom Video Communications', installDate: '2026-01-18T10:00:00Z', architecture: 'x86_64', createdAt: '2026-01-18T10:00:00Z', updatedAt: '2026-01-18T10:00:00Z' },
          { id: `sw-8-${device.id}`, deviceId: device.id, name: '7-Zip 23.01', version: '23.01.00.0', publisher: 'Igor Pavlov', installDate: '2026-01-15T09:05:00Z', architecture: 'x86_64', createdAt: '2026-01-15T09:05:00Z', updatedAt: '2026-01-15T09:05:00Z' },
        ]
      : isMac
      ? [
          { id: `sw-1-${device.id}`, deviceId: device.id, name: 'Ricoz Endpoint Agent', version: '0.1.0', publisher: 'Ricoz Security', installDate: '2026-02-01T10:15:00Z', architecture: 'arm64', createdAt: '2026-02-01T10:15:00Z', updatedAt: '2026-02-01T10:15:00Z' },
          { id: `sw-2-${device.id}`, deviceId: device.id, name: 'Google Chrome', version: '122.0.6261.94', publisher: 'Google LLC', installDate: '2026-02-01T10:30:00Z', architecture: 'arm64', createdAt: '2026-02-01T10:30:00Z', updatedAt: '2026-02-01T10:30:00Z' },
          { id: `sw-3-${device.id}`, deviceId: device.id, name: 'Slack', version: '4.36.140', publisher: 'Slack Technologies', installDate: '2026-02-01T10:45:00Z', architecture: 'arm64', createdAt: '2026-02-01T10:45:00Z', updatedAt: '2026-02-01T10:45:00Z' },
          { id: `sw-4-${device.id}`, deviceId: device.id, name: 'Docker Desktop', version: '4.28.0', publisher: 'Docker Inc.', installDate: '2026-02-02T09:00:00Z', architecture: 'arm64', createdAt: '2026-02-02T09:00:00Z', updatedAt: '2026-02-02T09:00:00Z' },
          { id: `sw-5-${device.id}`, deviceId: device.id, name: 'Visual Studio Code', version: '1.87.0', publisher: 'Microsoft Corporation', installDate: '2026-02-01T11:00:00Z', architecture: 'arm64', createdAt: '2026-02-01T11:00:00Z', updatedAt: '2026-02-01T11:00:00Z' },
          { id: `sw-6-${device.id}`, deviceId: device.id, name: '1Password 8', version: '8.10.28', publisher: 'AgileBits Inc.', installDate: '2026-02-01T10:20:00Z', architecture: 'arm64', createdAt: '2026-02-01T10:20:00Z', updatedAt: '2026-02-01T10:20:00Z' },
          { id: `sw-7-${device.id}`, deviceId: device.id, name: 'Zoom.us', version: '5.17.11', publisher: 'Zoom Video Communications', installDate: '2026-02-01T12:00:00Z', architecture: 'arm64', createdAt: '2026-02-01T12:00:00Z', updatedAt: '2026-02-01T12:00:00Z' },
        ]
      : [
          { id: `sw-1-${device.id}`, deviceId: device.id, name: 'Ricoz Endpoint Agent (systemd)', version: '0.1.0', publisher: 'Ricoz Security', installDate: '2026-02-10T14:20:00Z', architecture: 'x86_64', createdAt: '2026-02-10T14:20:00Z', updatedAt: '2026-02-10T14:20:00Z' },
          { id: `sw-2-${device.id}`, deviceId: device.id, name: 'OpenSSH Server', version: '8.9p1-3ubuntu0.6', publisher: 'Canonical Ltd.', installDate: '2026-02-10T14:22:00Z', architecture: 'x86_64', createdAt: '2026-02-10T14:22:00Z', updatedAt: '2026-02-10T14:22:00Z' },
          { id: `sw-3-${device.id}`, deviceId: device.id, name: 'Docker Engine Community', version: '25.0.3', publisher: 'Docker Inc.', installDate: '2026-02-10T14:25:00Z', architecture: 'x86_64', createdAt: '2026-02-10T14:25:00Z', updatedAt: '2026-02-10T14:25:00Z' },
          { id: `sw-4-${device.id}`, deviceId: device.id, name: 'Python 3 Runtime', version: '3.11.8', publisher: 'Python Software Foundation', installDate: '2026-02-10T14:21:00Z', architecture: 'x86_64', createdAt: '2026-02-10T14:21:00Z', updatedAt: '2026-02-10T14:21:00Z' },
          { id: `sw-5-${device.id}`, deviceId: device.id, name: 'UFW Firewall', version: '0.36.1', publisher: 'Ubuntu Core Developers', installDate: '2026-02-10T14:21:00Z', architecture: 'x86_64', createdAt: '2026-02-10T14:21:00Z', updatedAt: '2026-02-10T14:21:00Z' },
        ]
  );

  // 3. Assigned Policies
  const policies = device.policies && device.policies.length > 0 ? device.policies : [
    {
      id: `pol-asgn-1-${device.id}`,
      policyId: 'pol-001',
      deviceId: device.id,
      groupId: null,
      priority: 1,
      createdAt: '2026-01-15T08:30:00Z',
      policy: {
        id: 'pol-001',
        organizationId: device.organizationId,
        name: isWin ? 'BitLocker Volume Encryption Enforcement' : isMac ? 'FileVault Full Disk Encryption' : 'LUKS System Partition Encryption',
        type: 'SECURITY',
        description: 'Mandates hardware-backed disk encryption and escrow of recovery keys to organization vault.',
        settings: JSON.stringify({ cipher: 'XTS-AES-256', require_tpm: true, recovery_key_escrow: true }),
        isActive: true,
      },
    },
    {
      id: `pol-asgn-2-${device.id}`,
      policyId: 'pol-002',
      deviceId: device.id,
      groupId: null,
      priority: 2,
      createdAt: '2026-01-15T08:30:00Z',
      policy: {
        id: 'pol-002',
        organizationId: device.organizationId,
        name: 'Host Firewall & Network Inbound Filtering',
        type: 'SECURITY',
        description: 'Blocks unsolicited incoming connections and strictly permits authorized enterprise VPN tunnels.',
        settings: JSON.stringify({ default_inbound: 'block', default_outbound: 'allow', log_dropped_packets: true }),
        isActive: true,
      },
    },
    {
      id: `pol-asgn-3-${device.id}`,
      policyId: 'pol-003',
      deviceId: device.id,
      groupId: null,
      priority: 3,
      createdAt: '2026-01-16T10:00:00Z',
      policy: {
        id: 'pol-003',
        organizationId: device.organizationId,
        name: 'Screen Inactivity Lockout & Password Complexity',
        type: 'CONFIGURATION',
        description: 'Enforces automatic screen lock after 10 minutes of inactivity and requires 14+ character passwords.',
        settings: JSON.stringify({ max_inactivity_seconds: 600, min_password_length: 14, require_mfa: true }),
        isActive: true,
      },
    },
    {
      id: `pol-asgn-4-${device.id}`,
      policyId: 'pol-004',
      deviceId: device.id,
      groupId: null,
      priority: 4,
      createdAt: '2026-01-20T12:00:00Z',
      policy: {
        id: 'pol-004',
        organizationId: device.organizationId,
        name: 'USB Removable Media Read-Only Restriction',
        type: 'COMPLIANCE',
        description: 'Prevents data exfiltration by restricting unauthorized external flash drives to read-only mode.',
        settings: JSON.stringify({ removable_storage_mode: 'read_only', log_mount_events: true }),
        isActive: true,
      },
    },
  ];

  // 4. Compliance Results
  const complianceResults = device.complianceResults && device.complianceResults.length > 0 ? device.complianceResults : [
    {
      id: `cmp-1-${device.id}`,
      deviceId: device.id,
      ruleId: 'c-rule-1',
      status: 'COMPLIANT',
      reason: isWin ? 'BitLocker protection is active on volume C: with TPM key protector' : isMac ? 'FileVault 2 encryption enabled on APFS root volume' : 'LUKS encryption active on root filesystem',
      evaluatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      rule: {
        id: 'c-rule-1',
        organizationId: device.organizationId,
        name: 'CIS 1.1: System Volume Full Disk Encryption',
        description: 'Verify storage drives are encrypted with strong algorithm.',
        ruleType: 'SECURITY_BASELINE',
        condition: '{"encryption_state": "encrypted"}',
        isActive: true,
      },
    },
    {
      id: `cmp-2-${device.id}`,
      deviceId: device.id,
      ruleId: 'c-rule-2',
      status: 'COMPLIANT',
      reason: 'Host firewall enabled across domain, private, and public network profiles',
      evaluatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      rule: {
        id: 'c-rule-2',
        organizationId: device.organizationId,
        name: 'CIS 2.1: Host Firewall Active and Filtering',
        description: 'Ensure local firewall daemon is running and filtering inbound traffic.',
        ruleType: 'SECURITY_BASELINE',
        condition: '{"firewall_active": true}',
        isActive: true,
      },
    },
    {
      id: `cmp-3-${device.id}`,
      deviceId: device.id,
      ruleId: 'c-rule-3',
      status: 'COMPLIANT',
      reason: 'Screen lock timeout configured to 600 seconds with mandatory password authentication',
      evaluatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      rule: {
        id: 'c-rule-3',
        organizationId: device.organizationId,
        name: 'CIS 3.2: Screen Inactivity Lock Threshold <= 15 Min',
        description: 'Lock screen when workstation is left unattended.',
        ruleType: 'ACCESS_CONTROL',
        condition: '{"max_idle_timeout": 900}',
        isActive: true,
      },
    },
    {
      id: `cmp-4-${device.id}`,
      deviceId: device.id,
      ruleId: 'c-rule-4',
      status: device.status === 'OFFLINE' ? 'WARNING' : 'COMPLIANT',
      reason: device.status === 'OFFLINE' ? 'Agent heartbeat missed scheduled check-in window (> 4 hours)' : 'EDR agent process running and reporting realtime telemetry',
      evaluatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      rule: {
        id: 'c-rule-4',
        organizationId: device.organizationId,
        name: 'CIS 4.1: Endpoint Security Daemon Health & Check-in',
        description: 'Ensure agent daemon maintains active connection with telemetry gateway.',
        ruleType: 'AVAILABILITY',
        condition: '{"heartbeat_interval_sec": 60}',
        isActive: true,
      },
    },
    {
      id: `cmp-5-${device.id}`,
      deviceId: device.id,
      ruleId: 'c-rule-5',
      status: device.status === 'PENDING' ? 'NON_COMPLIANT' : (device.status === 'OFFLINE' ? 'WARNING' : 'COMPLIANT'),
      reason: device.status === 'PENDING'
        ? 'Pending enrollment: Automatic OS security updates policy not yet acknowledged by endpoint'
        : (device.status === 'OFFLINE'
          ? 'Patch status verification delayed due to endpoint inactivity'
          : 'All critical OS security updates verified up-to-date (0 zero-day vulnerabilities)'),
      evaluatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      rule: {
        id: 'c-rule-5',
        organizationId: device.organizationId,
        name: 'CIS 5.2: OS Critical Security Patch Schedule',
        description: 'Verify cumulative security update latency is under 14 days.',
        ruleType: 'VULNERABILITY_MANAGEMENT',
        condition: '{"max_patch_age_days": 14}',
        isActive: true,
      },
    },
    {
      id: `cmp-6-${device.id}`,
      deviceId: device.id,
      ruleId: 'c-rule-6',
      status: device.id === 'dev-001' || device.status === 'PENDING' ? 'NON_COMPLIANT' : 'COMPLIANT',
      reason: device.id === 'dev-001' || device.status === 'PENDING'
        ? 'Guest account status: local guest account is enabled or password is not set to expire'
        : 'Guest account disabled and root login restrictions verified across all local authenticators',
      evaluatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      rule: {
        id: 'c-rule-6',
        organizationId: device.organizationId,
        name: 'CIS 6.1: Local Guest Account Disabled',
        description: 'Ensure guest and default system accounts are permanently disabled.',
        ruleType: 'IDENTITY_ACCESS',
        condition: '{"guest_account_enabled": false}',
        isActive: true,
      },
    },
  ];

  // 5. Remote Commands History
  const commands = device.commands && device.commands.length > 0 ? device.commands : [
    {
      id: `cmd-101-${device.id}`,
      organizationId: device.organizationId,
      deviceId: device.id,
      type: 'TELEMETRY_SYNC',
      status: 'COMPLETED',
      requestedBy: 'admin@ricoz.corp',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 1000).toISOString(),
      completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 4500).toISOString(),
      result: 'Successfully synchronized hardware telemetry (1 CPU, 2 RAM slots, 1 NVMe) and 8 installed applications.',
      errorMessage: null,
    },
    {
      id: `cmd-102-${device.id}`,
      organizationId: device.organizationId,
      deviceId: device.id,
      type: 'POLICY_REFRESH',
      status: 'COMPLETED',
      requestedBy: 'System Automation',
      createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 18 * 60 * 60 * 1000 + 500).toISOString(),
      completedAt: new Date(Date.now() - 18 * 60 * 60 * 1000 + 2000).toISOString(),
      result: 'Applied 4 organization baseline configuration profiles with 0 drift.',
      errorMessage: null,
    },
    {
      id: `cmd-103-${device.id}`,
      organizationId: device.organizationId,
      deviceId: device.id,
      type: 'INVENTORY_SCAN',
      status: 'COMPLETED',
      requestedBy: 'security-audit@ricoz.corp',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 800).toISOString(),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 6200).toISOString(),
      result: 'Package signature verification passed. 0 unapproved binary executables detected.',
      errorMessage: null,
    },
  ];

  // 6. Heartbeats
  const heartbeats = device.heartbeats && device.heartbeats.length > 0 ? device.heartbeats : [
    { id: `hb-1-${device.id}`, deviceId: device.id, agentVersion: device.agentVersion || 'v0.1.0', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), status: 'HEALTHY', createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
    { id: `hb-2-${device.id}`, deviceId: device.id, agentVersion: device.agentVersion || 'v0.1.0', timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), status: 'HEALTHY', createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
    { id: `hb-3-${device.id}`, deviceId: device.id, agentVersion: device.agentVersion || 'v0.1.0', timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(), status: 'HEALTHY', createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString() },
    { id: `hb-4-${device.id}`, deviceId: device.id, agentVersion: device.agentVersion || 'v0.1.0', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), status: 'HEALTHY', createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  ];

  return {
    ...device,
    hardware,
    software,
    policies,
    complianceResults,
    commands,
    heartbeats,
  };
}

/**
 * Retrieves full telemetry, hardware, and relationship specifications for a single endpoint.
 *
 * @param id - The unique ID or serial number of the device
 */
export async function getDeviceById(id: string): Promise<DeviceDetailApiResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 150));

  // ==========================================================================
  // TODO (Dharshan): When GET /api/devices/:id is ready in Fastify, uncomment:
  //
  // return fetchApi<Device>(`/devices/${encodeURIComponent(id)}`);
  // ==========================================================================

  const device = mockDevices.find((d) => d.id === id || d.serialNumber === id);

  if (!device) {
    return {
      success: false,
      error: {
        code: 'DEVICE_NOT_FOUND',
        message: `Endpoint with ID '${id}' was not found in organization inventory.`,
      },
    };
  }

  return {
    success: true,
    data: enrichDeviceWithRelations(device),
  };
}
