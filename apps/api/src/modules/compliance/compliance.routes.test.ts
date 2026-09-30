import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
  error?: { code?: string; message?: string };
}

interface RollupResponse {
  success: boolean;
  data?: {
    range: string;
    score: number;
    summary: {
      totalDevices: number;
      evaluated: number;
      compliant: number;
      nonCompliant: number;
      untested: number;
    };
    controls: Array<{
      id: string;
      name: string;
      kind: string;
      compliantCount: number;
      nonCompliantCount: number;
      status: string;
    }>;
    devices: Array<{
      id: string;
      status: string;
      violations: number;
      reason: string;
      deviceName: string;
      hostname: string;
      serialNumber: string;
    }>;
    pagination: { page: number; limit: number; total: number };
  };
  error?: { code: string; message: string };
}

interface DeviceDetailResponse {
  success: boolean;
  data?: {
    device: { id: string; deviceName: string; hostname: string };
    summary: {
      status: string;
      compliant: number;
      nonCompliant: number;
      total: number;
      evaluatedAt: string | null;
    };
    controls: Array<{
      id: string;
      source: string;
      sourceId: string | null;
      name: string;
      status: string;
      reason: string;
    }>;
    history: Array<{
      id: string;
      status: string;
      source: string;
      sourceName: string;
      reason: string;
    }>;
    historyTotal: number;
  };
  error?: { code: string; message: string };
}

describe('Compliance REST API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let viewerToken: string;
  let operatorToken: string;
  let orgAdminToken: string;
  let demoOrgId: string;
  let violatingDeviceId: string;
  let violatingAgentToken: string;
  let violationPolicyId: string;
  let ruleId: string;
  let foreignDeviceId: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();

    const login = async (email: string, password: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password },
      });
      const body = res.json() as LoginResponse;
      if (!body.data?.token) {
        throw new Error(
          `login failed for ${email} (HTTP ${res.statusCode}): ${JSON.stringify(body.error ?? body)}`
        );
      }
      return body.data.token;
    };

    adminToken = await login('admin@ricoz.local', 'admin123');

    const demoOrg = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    demoOrgId = demoOrg.id;

    // Dedicated operator: never touch the shared seed account, so parallel
    // test files are not affected by password changes made here.
    const operatorUser = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: `compliance-operator-${runId}@ricoz.local`,
        name: 'Compliance Operator',
        passwordHash: await hashPassword('operator123'),
        role: 'OPERATOR',
      },
    });
    operatorToken = await login(operatorUser.email, 'operator123');

    const viewerUser = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: `compliance-viewer-${runId}@ricoz.local`,
        name: 'Compliance Viewer',
        passwordHash: await hashPassword('viewer123'),
        role: 'VIEWER',
      },
    });
    viewerToken = await login(viewerUser.email, 'viewer123');

    // Tenant-scoped admin: must not be able to read another org's devices.
    const orgAdmin = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: `compliance-orgadmin-${runId}@ricoz.local`,
        name: 'Compliance Org Admin',
        passwordHash: await hashPassword('orgadmin123'),
        role: 'ORG_ADMIN',
      },
    });
    orgAdminToken = await login(orgAdmin.email, 'orgadmin123');

    // Enroll a dedicated device so heartbeat-driven evaluation has a target.
    const tokenRes = await app.inject({
      method: 'POST',
      url: '/api/enrollment-tokens',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { label: `compliance-test-${runId}`, maxUses: 1 },
    });
    const token = (tokenRes.json() as { data: { token: string } }).data.token;

    const enrollRes = await app.inject({
      method: 'POST',
      url: '/api/enroll',
      payload: {
        enrollmentToken: token,
        hostname: 'COMPLIANCE-TEST-HOST',
        serialNumber: `SN-COMPLIANCE-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        agentVersion: '0.1.0',
      },
    });
    const enrollBody = enrollRes.json() as {
      data?: { deviceId?: string; agentToken?: string };
    };
    assert.ok(enrollRes.statusCode === 201 && enrollBody.data?.deviceId);
    violatingDeviceId = enrollBody.data.deviceId!;
    violatingAgentToken = enrollBody.data.agentToken!;

    // Policy that the test device will violate (firewall + antivirus off).
    const policyRes = await app.inject({
      method: 'POST',
      url: '/api/policies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: `TEST-COMPLIANCE-POLICY-${runId}`,
        type: 'SECURITY',
        description: 'Compliance API test policy',
        settings: { firewallRequired: true, antivirusRequired: true },
        isActive: true,
      },
    });
    violationPolicyId = (policyRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: 'POST',
      url: `/api/policies/${violationPolicyId}/assign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceIds: [violatingDeviceId] },
    });

    const heartbeat = await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: { 'x-agent-token': violatingAgentToken },
      payload: {
        deviceId: violatingDeviceId,
        agentVersion: '0.1.0',
        timestamp: new Date().toISOString(),
        status: 'ONLINE',
        security: { firewallEnabled: false, antivirusEnabled: false },
      },
    });
    assert.equal(heartbeat.statusCode, 200);

    // A compliance rule exists for control rollups (rule results are not
    // produced by any engine today, so it should surface as NOT_EVALUATED).
    const rule = await app.prisma.complianceRule.create({
      data: {
        organizationId: demoOrgId,
        name: `TEST-COMPLIANCE-RULE-${runId}`,
        description: 'Compliance API test rule',
        ruleType: 'OS_VERSION',
        condition: JSON.stringify({ minVersion: '10.0' }),
      },
    });
    ruleId = rule.id;

    // A device in a different tenant, used for cross-org isolation checks.
    const foreignOrg = await app.prisma.organization.create({
      data: { name: `Compliance Foreign Org ${runId}` },
    });
    const foreignDevice = await app.prisma.device.create({
      data: {
        organizationId: foreignOrg.id,
        deviceName: 'Foreign Device',
        hostname: 'foreign-host',
        serialNumber: `SN-FOREIGN-${runId}`,
        os: 'Linux',
        osVersion: 'Ubuntu 24.04',
        architecture: 'x86_64',
      },
    });
    foreignDeviceId = foreignDevice.id;
  });

  after(async () => {
    if (violatingDeviceId) {
      await app.prisma.complianceResult
        .deleteMany({ where: { deviceId: violatingDeviceId } })
        .catch(() => undefined);
    }
    if (ruleId) {
      await app.prisma.complianceRule.delete({ where: { id: ruleId } }).catch(() => undefined);
    }
    if (violationPolicyId) {
      await app.prisma.policy.delete({ where: { id: violationPolicyId } }).catch(() => undefined);
    }
    const deviceIds = [violatingDeviceId, foreignDeviceId].filter(Boolean);
    if (deviceIds.length > 0) {
      await app.prisma.device.deleteMany({ where: { id: { in: deviceIds } } }).catch(() => undefined);
    }
    await app.prisma.user
      .deleteMany({
        where: {
          OR: [
            { email: { contains: `compliance-viewer-${runId}` } },
            { email: { contains: `compliance-orgadmin-${runId}` } },
            { email: { contains: `compliance-operator-${runId}` } },
          ],
        },
      })
      .catch(() => undefined);
    await app.prisma.organization
      .deleteMany({ where: { name: `Compliance Foreign Org ${runId}` } })
      .catch(() => undefined);
    await app.close();
  });

  it('returns a fleet rollup with score, summary, controls and pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance?range=24h&status=ALL',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);

    const body = res.json() as RollupResponse;
    assert.equal(body.success, true);
    assert.ok(body.data);

    const { summary } = body.data;
    assert.ok(summary.totalDevices > 0, 'fleet has devices');
    assert.equal(
      summary.compliant + summary.nonCompliant + summary.untested,
      summary.totalDevices,
      'summary buckets are exhaustive'
    );
    assert.equal(summary.evaluated, summary.compliant + summary.nonCompliant);
    assert.equal(summary.nonCompliant >= 1, true, 'the violating device is counted');
    assert.equal(typeof body.data.score, 'number');
    assert.ok(body.data.score >= 0 && body.data.score <= 100);
    assert.equal(body.data.range, '24h');
    assert.ok(Array.isArray(body.data.controls));
    assert.ok(body.data.controls.length >= 1, 'assigned policy appears as a control');
    assert.equal(body.data.pagination.total, summary.totalDevices, 'ALL returns every device');
  });

  it('surfaces the violating device in the NON_COMPLIANT device list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance?status=NON_COMPLIANT&limit=100',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);

    const body = res.json() as RollupResponse;
    const flagged = body.data!.devices.find((d) => d.id === violatingDeviceId);

    assert.ok(flagged, 'violating device is present in the non-compliant list');
    assert.equal(flagged!.status, 'NON_COMPLIANT');
    assert.ok(flagged!.violations >= 1, 'at least one failing check');
    assert.ok(flagged!.reason.length > 0, 'a human-readable reason is returned');
    assert.equal(body.data!.pagination.total, body.data!.summary.nonCompliant);
  });

  it('excludes the violating device from the COMPLIANT list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance?status=COMPLIANT&limit=100',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);

    const body = res.json() as RollupResponse;
    assert.equal(
      body.data!.devices.some((d) => d.id === violatingDeviceId),
      false,
      'violating device is not reported as compliant'
    );
    assert.equal(body.data!.pagination.total, body.data!.summary.compliant);
  });

  it('supports search filtering by hostname', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance?status=ALL&search=COMPLIANCE-TEST-HOST',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);

    const body = res.json() as RollupResponse;
    assert.equal(body.data!.pagination.total, 1);
    assert.equal(body.data!.devices[0]!.id, violatingDeviceId);
  });

  it('paginates the device list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance?status=ALL&page=1&limit=2',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);

    const body = res.json() as RollupResponse;
    assert.equal(body.data!.devices.length, 2);
    assert.equal(body.data!.pagination.page, 1);
    assert.equal(body.data!.pagination.limit, 2);
    assert.ok(body.data!.pagination.total > 2);
  });

  it('marks rules with no results as NOT_EVALUATED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance?status=ALL',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.json() as RollupResponse;
    const rule = body.data!.controls.find((c) => c.id === `rule:${ruleId}`);

    assert.ok(rule, 'rule appears in controls');
    assert.equal(rule!.status, 'NOT_EVALUATED');
    assert.equal(rule!.compliantCount, 0);
    assert.equal(rule!.nonCompliantCount, 0);
    assert.equal(rule!.kind, 'RULE');
  });

  it('reports the assigned policy as an AT_RISK control', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance?status=ALL&range=24h',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.json() as RollupResponse;
    const control = body.data!.controls.find((c) => c.id === `policy:${violationPolicyId}`);

    assert.ok(control, 'policy appears in controls');
    assert.equal(control!.kind, 'POLICY');
    assert.equal(control!.status, 'AT_RISK');
    assert.ok(control!.nonCompliantCount >= 1);
    assert.equal(control!.name, `TEST-COMPLIANCE-POLICY-${runId}`);
  });

  it('rejects an unknown range with a validation error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance?range=99d',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as { success: boolean; error?: { code: string } };
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/compliance' });
    assert.equal(res.statusCode, 401);
  });

  it('returns per-device detail with current checks and history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/compliance/device/${violatingDeviceId}?limit=25`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);

    const body = res.json() as DeviceDetailResponse;
    assert.ok(body.data);
    assert.equal(body.data!.device.id, violatingDeviceId);
    assert.equal(body.data!.summary.status, 'NON_COMPLIANT');
    assert.ok(body.data!.summary.total >= 1);
    assert.ok(body.data!.summary.nonCompliant >= 1);
    assert.ok(body.data!.summary.evaluatedAt, 'records when it was evaluated');

    const policyCheck = body.data!.controls.find(
      (c) => c.source === 'POLICY' && c.sourceId === violationPolicyId
    );
    assert.ok(policyCheck, 'policy check is listed');
    assert.equal(policyCheck!.status, 'NON_COMPLIANT');
    assert.equal(policyCheck!.name, `TEST-COMPLIANCE-POLICY-${runId}`);
    assert.ok(policyCheck!.reason.length > 0, 'marker stripped from the reason');

    assert.ok(body.data!.history.length >= 1);
    assert.ok(body.data!.historyTotal >= 1);
    assert.equal(body.data!.history[0]!.source, 'POLICY');
    assert.equal(
      body.data!.history.every((h) => h.reason.includes('__ricoz_policy__')),
      false,
      'internal policy marker is not exposed'
    );
  });

  it('exposes the same detail through the plural alias', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/compliance/devices/${violatingDeviceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as DeviceDetailResponse;
    assert.equal(body.data!.device.id, violatingDeviceId);
  });

  it('filters device history by status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/compliance/device/${violatingDeviceId}?status=COMPLIANT`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as DeviceDetailResponse;
    assert.equal(body.data!.history.length, 0, 'device has no passing checks');

    const nonCompliant = await app.inject({
      method: 'GET',
      url: `/api/compliance/device/${violatingDeviceId}?status=NON_COMPLIANT`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body2 = nonCompliant.json() as DeviceDetailResponse;
    assert.ok(body2.data!.history.length >= 1);
    assert.ok(body2.data!.history.every((h) => h.status === 'NON_COMPLIANT'));
  });

  it('returns 404 for an unknown device', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance/device/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 404);
  });

  it('scopes device detail to the caller tenant', async () => {
    // Tenant-scoped admin cannot read another organization's device.
    const scoped = await app.inject({
      method: 'GET',
      url: `/api/compliance/device/${foreignDeviceId}`,
      headers: { authorization: `Bearer ${orgAdminToken}` },
    });
    assert.equal(scoped.statusCode, 404);

    // SUPER_ADMIN is intentionally cross-tenant, matching the device routes.
    const superAdmin = await app.inject({
      method: 'GET',
      url: `/api/compliance/device/${foreignDeviceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(superAdmin.statusCode, 200);
  });

  it('allows VIEWER to read compliance data', async () => {
    const rollup = await app.inject({
      method: 'GET',
      url: '/api/compliance?status=ALL',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(rollup.statusCode, 200);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/compliance/device/${violatingDeviceId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(detail.statusCode, 200);
  });

  it('blocks VIEWER and OPERATOR from triggering evaluation (403)', async () => {
    for (const token of [viewerToken, operatorToken]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/compliance/evaluate',
        headers: { authorization: `Bearer ${token}` },
        payload: { deviceId: violatingDeviceId },
      });
      assert.equal(res.statusCode, 403);
    }
  });

  it('re-evaluates a single device and returns per-device outcomes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/compliance/evaluate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceId: violatingDeviceId },
    });
    assert.equal(res.statusCode, 200);

    const body = res.json() as {
      data: {
        evaluated: number;
        violations: number;
        devices: Array<{ deviceId: string; evaluated: number; violation: number }>;
      };
    };
    assert.equal(body.data.evaluated, 1);
    assert.equal(body.data.violations, 1, 'policy still fails');
    assert.equal(body.data.devices[0]!.deviceId, violatingDeviceId);
    assert.equal(body.data.devices[0]!.evaluated, 1);

    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'COMPLIANCE_EVALUATED' },
      orderBy: { timestamp: 'desc' },
    });
    assert.ok(audit, 'evaluation is audited');
    assert.equal(audit!.resourceId, violatingDeviceId);
  });

  it('evaluates the whole fleet', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/compliance/evaluate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { all: true },
    });
    assert.equal(res.statusCode, 200);

    const body = res.json() as {
      data: { evaluated: number; violations: number; devices: Array<{ deviceId: string }> };
    };
    assert.ok(body.data.evaluated > 1, 'multiple devices evaluated');
    assert.ok(body.data.devices.some((d) => d.deviceId === violatingDeviceId));
  });

  it('accepts an explicit batch of device ids', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/compliance/evaluate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceIds: [violatingDeviceId] },
    });
    assert.equal(res.statusCode, 200);
    assert.equal((res.json() as { data: { evaluated: number } }).data.evaluated, 1);
  });

  it('rejects a body with multiple target selectors (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/compliance/evaluate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceId: violatingDeviceId, all: true },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as { success: boolean; error?: { message: string } };
    assert.equal(body.success, false);
    assert.match(body.error!.message, /exactly one/i);
  });

  it('rejects an empty evaluation request (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/compliance/evaluate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    assert.equal(res.statusCode, 400);
  });

  it('returns 404 when evaluating an unknown device', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/compliance/evaluate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceId: '00000000-0000-0000-0000-000000000000' },
    });
    assert.equal(res.statusCode, 404);
  });

  it('rejects an invalid device id on the detail route (400)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/compliance/device/not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 400);
  });
});
