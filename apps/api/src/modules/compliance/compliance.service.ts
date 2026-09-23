import type { PrismaClient } from '@prisma/client';
import { createAlertDedup } from '../alerts/alerts.service';

interface PolicySettings {
  firewallRequired?: boolean;
  antivirusRequired?: boolean;
  minOsVersion?: string;
  minAgentVersion?: string;
  autoLockMinutes?: number;
}

export interface DeviceSecurityState {
  firewallEnabled?: boolean;
  antivirusEnabled?: boolean;
}

interface EffectivePolicy {
  id: string;
  name: string;
  type: string;
  settings: PolicySettings;
  priority: number;
}

const POLICY_MARKER_PREFIX = '__ricoz_policy__';

function markerFor(policyId: string): string {
  return `${POLICY_MARKER_PREFIX}${policyId}`;
}

function policyMarkerFromReason(reason: string): string | null {
  const idx = reason.indexOf(POLICY_MARKER_PREFIX);
  if (idx === -1) return null;
  return reason.slice(idx);
}

function versionTuple(version: string): number[] {
  return version
    .split(/[.\-_+]/)
    .map((part) => {
      const n = parseInt(part, 10);
      return Number.isNaN(n) ? 0 : n;
    })
    .slice(0, 4);
}

function versionAtLeast(current: string, minimum?: string): boolean {
  if (!minimum) return true;
  const cur = versionTuple(current);
  const min = versionTuple(minimum);
  const len = Math.max(cur.length, min.length);
  for (let i = 0; i < len; i++) {
    const a = cur[i] ?? 0;
    const b = min[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}

export interface ComplianceEvaluationResult {
  policy: EffectivePolicy;
  status: 'COMPLIANT' | 'NON_COMPLIANT';
  reason: string;
}

/**
 * Evaluate a single policy against the device's current security state.
 */
export function evaluatePolicy(
  policy: EffectivePolicy,
  device: { firewallEnabled?: boolean | null; antivirusEnabled?: boolean | null; osVersion?: string | null; agentVersion?: string | null }
): ComplianceEvaluationResult {
  const settings = policy.settings ?? {};
  const violations: string[] = [];

  if (policy.type === 'SECURITY') {
    if (settings.firewallRequired && !device.firewallEnabled) {
      violations.push('Firewall is required but is disabled');
    }
    if (settings.antivirusRequired && !device.antivirusEnabled) {
      violations.push('Antivirus is required but is not active');
    }
  }

  if (policy.type === 'COMPLIANCE') {
    if (settings.minOsVersion && device.osVersion && !versionAtLeast(device.osVersion, settings.minOsVersion)) {
      violations.push(
        `OS version ${device.osVersion} is below required minimum ${settings.minOsVersion}`
      );
    }
    if (settings.minAgentVersion && device.agentVersion && !versionAtLeast(device.agentVersion, settings.minAgentVersion)) {
      violations.push(
        `Agent version ${device.agentVersion} is below required minimum ${settings.minAgentVersion}`
      );
    }
    if (settings.minOsVersion && !device.osVersion) {
      violations.push('OS version is unknown; minimum required version cannot be verified');
    }
  }

  const status = violations.length === 0 ? 'COMPLIANT' : 'NON_COMPLIANT';
  return {
    policy,
    status,
    reason: violations.length > 0 ? violations.join('; ') : 'Policy requirements satisfied',
  };
}

/**
 * Run compliance evaluation for a device against all active assigned policies
 * (direct device assignments + group assignments). Persists evaluated results
 * (replacing any previous policy-based results for this device) and raises
 * violation alerts (deduplicated per OPEN alert + device + policy).
 */
export async function evaluateDeviceCompliance(
  prisma: PrismaClient,
  deviceId: string,
  security: DeviceSecurityState = {},
  organizationId?: string
) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      organizationId: true,
      firewallEnabled: true,
      antivirusEnabled: true,
      osVersion: true,
      agentVersion: true,
    },
  });

  if (!device) {
    return { evaluated: 0, violation: 0 };
  }

  // Effective policies: direct assignments + assignments via groups the device belongs to.
  const memberGroups = await prisma.deviceGroupMember.findMany({
    where: { deviceId: device.id },
    select: { groupId: true },
  });
  const groupIds = memberGroups.map((m) => m.groupId);

  const assignments = await prisma.policyAssignment.findMany({
    where: {
      policy: { isActive: true },
      OR: [
        { deviceId: device.id },
        ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
      ],
    },
    orderBy: { priority: 'asc' },
    select: {
      priority: true,
      policy: {
        select: { id: true, name: true, type: true, settings: true },
      },
    },
  });

  const policyMap = new Map<string, EffectivePolicy>();
  for (const assignment of assignments) {
    const policy = assignment.policy;
    if (!policyMap.has(policy.id)) {
      let settings: PolicySettings = {};
      try {
        settings = JSON.parse(policy.settings ?? '{}') as PolicySettings;
      } catch {
        settings = {};
      }
      policyMap.set(policy.id, {
        id: policy.id,
        name: policy.name,
        type: policy.type,
        settings,
        priority: assignment.priority,
      });
    }
  }

  const effectivePolicies = Array.from(policyMap.values());

  // Remove stale policy-based results for this device before re-evaluating.
  const staleResults = await prisma.complianceResult.findMany({
    where: { deviceId: device.id, ruleId: null, NOT: { reason: '' } },
    select: { id: true, reason: true },
  });
  const policyStaleIds = staleResults
    .filter((r) => policyMarkerFromReason(r.reason) !== null)
    .map((r) => r.id);
  if (policyStaleIds.length > 0) {
    await prisma.complianceResult.deleteMany({ where: { id: { in: policyStaleIds } } });
  }

  const orgId = organizationId ?? device.organizationId;
  let violation = 0;

  for (const policy of effectivePolicies) {
    const result = evaluatePolicy(policy, device);

    await prisma.complianceResult.create({
      data: {
        deviceId: device.id,
        status: result.status,
        reason: `${result.reason} [${markerFor(policy.id)}]`,
        evaluatedAt: new Date(),
      },
    });

    if (result.status === 'NON_COMPLIANT') {
      violation += 1;
      await createAlertDedup(prisma, {
        organizationId: orgId,
        deviceId: device.id,
        type: 'COMPLIANCE_VIOLATION',
        severity: 'WARNING',
        title: `Policy violation: ${policy.name}`,
        message: `Device is non-compliant with policy "${policy.name}": ${result.reason}`,
        dedupKey: `policy:${policy.id}`,
      });
    }
  }

  // Also flag devices that report a security state but no effective policy at all.
  const hasSecurityExpectation =
    typeof security.firewallEnabled === 'boolean' || typeof security.antivirusEnabled === 'boolean';

  return {
    evaluated: effectivePolicies.length,
    violation,
    hasSecurityExpectation,
  };
}