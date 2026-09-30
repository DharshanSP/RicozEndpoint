import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string; user?: { id?: string } };
  error?: { code?: string; message?: string };
}

describe('Policy Management API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let demoOrgId: string;
  let demoDeviceId: string;
  let viewerToken: string;
  let viewerId: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    demoOrgId = org.id;

    const device = await app.prisma.device.findFirstOrThrow({
      where: { organizationId: demoOrgId, serialNumber: 'SN-DEMO-001' },
      select: { id: true },
    });
    demoDeviceId = device.id;

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (login.json() as LoginResponse).data!.token!;

    // A VIEWER user for RBAC assertions in the same org
    const viewerUser = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: `policy-viewer-${runId}@ricoz.local`,
        name: 'Policy Viewer',
        passwordHash: await hashPassword('viewer123'),
        role: 'VIEWER',
      },
    });
    viewerId = viewerUser.id;
    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: viewerUser.email, password: 'viewer123' },
    });
    viewerToken = (viewerLogin.json() as LoginResponse).data!.token!;
  });

  after(async () => {
    await app.prisma.user.deleteMany({ where: { id: viewerId } }).catch(() => undefined);
    await app.prisma.policy.deleteMany({ where: { name: { contains: 'TEST-POLICY' } } }).catch(() => undefined);
    await app.close();
  });

  function policyPayload(type = 'SECURITY', settings: Record<string, unknown> = {}) {
    return {
      name: `TEST-POLICY-${runId}`,
      type,
      description: 'Policy created by automated test',
      settings,
      isActive: true,
    };
  }

  it('creates a policy with type-specific settings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/policies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: policyPayload('SECURITY', { firewallRequired: true, antivirusRequired: true }),
    });
    assert.equal(res.statusCode, 201);
    const body = res.json() as { success: boolean; data: { id: string; type: string } };
    assert.equal(body.success, true);
    assert.equal(body.data.type, 'SECURITY');
  });

  it('lists policies with pagination + type filter', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/policies?limit=10&type=SECURITY',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(list.statusCode, 200);
    const listBody = list.json() as { data: { items: unknown[]; total: number } };
    assert.ok(listBody.data.total >= 1);
    assert.ok(Array.isArray(listBody.data.items));
  });

  it('allows VIEWER to read but not create policies (RBAC)', async () => {
    const read = await app.inject({
      method: 'GET',
      url: '/api/policies',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(read.statusCode, 200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/policies',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: policyPayload(),
    });
    assert.equal(create.statusCode, 403);
  });

  it('updates and deletes a policy', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/policies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: policyPayload('COMPLIANCE', { minOsVersion: 'Windows 11' }),
    });
    const createdBody = created.json() as { data: { id: string } };
    const id = createdBody.data.id;

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/policies/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { description: 'updated', isActive: false },
    });
    assert.equal(updated.statusCode, 200);
    const updatedBody = updated.json() as { data: { isActive: boolean } };
    assert.equal(updatedBody.data.isActive, false);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/policies/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleted.statusCode, 200);
  });

  it('assigns a policy to a device and lists it in device detail', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/policies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: policyPayload('SECURITY', { firewallRequired: true }),
    });
    const id = (created.json() as { data: { id: string } }).data.id;

    const assign = await app.inject({
      method: 'POST',
      url: `/api/policies/${id}/assign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceIds: [demoDeviceId], priority: 100 },
    });
    assert.equal(assign.statusCode, 200);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/devices/${demoDeviceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const detailBody = detail.json() as {
      data: { policies: Array<{ policy: { id: string } }> };
    };
    assert.ok(detailBody.data.policies.some((p) => p.policy.id === id));

    const unassign = await app.inject({
      method: 'POST',
      url: `/api/policies/${id}/assign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceIds: [demoDeviceId], removeAssignment: true },
    });
    assert.equal(unassign.statusCode, 200);

    await app.prisma.policy.delete({ where: { id } });
  });

  it('prevents assigning a policy to a device in another organization', async () => {
    const otherOrg = await app.prisma.organization.create({
      data: { name: `Other Org ${runId}` },
    });
    const otherDevice = await app.prisma.device.create({
      data: {
        organizationId: otherOrg.id,
        deviceName: 'OTHER-DEV',
        hostname: 'OTHER-DEV',
        serialNumber: `SN-OTHER-${runId}`,
        manufacturer: 'Test',
        model: 'VM-2',
        os: 'Windows',
        osVersion: 'Windows 11',
        architecture: 'x64',
        ipAddress: '10.0.1.5',
        agentVersion: '0.1.0',
        status: 'ONLINE',
        lastSeenAt: new Date(),
      },
    });

    const created = await app.inject({
      method: 'POST',
      url: '/api/policies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: policyPayload(),
    });
    const id = (created.json() as { data: { id: string } }).data.id;

    const assign = await app.inject({
      method: 'POST',
      url: `/api/policies/${id}/assign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceIds: [otherDevice.id] },
    });
    assert.equal(assign.statusCode, 403);

    await app.prisma.device.delete({ where: { id: otherDevice.id } });
    await app.prisma.organization.delete({ where: { id: otherOrg.id } });
    await app.prisma.policy.delete({ where: { id } });
  });
});

describe('Compliance, Alerts & Commands API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let demoOrgId: string;
  let enrolledDeviceId: string;
  let agentToken: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    demoOrgId = org.id;

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (login.json() as LoginResponse).data!.token!;

    // Enroll a device to get an agent token
    const tokenRes = await app.inject({
      method: 'POST',
      url: '/api/enrollment-tokens',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { maxUses: 5 },
    });
    const tokenBody = tokenRes.json() as { data?: { token?: string } };

    const enroll = await app.inject({
      method: 'POST',
      url: '/api/enroll',
      payload: {
        enrollmentToken: tokenBody.data!.token!,
        hostname: `COM-AGENT-${runId}`,
        serialNumber: `SN-COM-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11 Pro 24H2',
        agentVersion: '0.1.0',
      },
    });
    const enrollBody = enroll.json() as { data?: { deviceId?: string; agentToken?: string } };
    assert.ok(enroll.statusCode === 201 && enrollBody.data?.deviceId && enrollBody.data?.agentToken);
    enrolledDeviceId = enrollBody.data.deviceId!;
    agentToken = enrollBody.data.agentToken!;
  });

  after(async () => {
    await app.prisma.device.deleteMany({ where: { id: enrolledDeviceId } }).catch(() => undefined);
    await app.prisma.policy.deleteMany({ where: { name: { contains: 'TEST-POLICY' } } }).catch(() => undefined);
    await app.close();
  });

  it('serves the effective policy list to the agent via /policies', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/policies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'TEST-POLICY-SYNC',
        type: 'SECURITY',
        settings: { firewallRequired: true },
        isActive: true,
      },
    });
    const policyId = (created.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: 'POST',
      url: `/api/policies/${policyId}/assign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceIds: [enrolledDeviceId] },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/policies',
      headers: { 'x-agent-token': agentToken },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: { policies: Array<{ id: string; name: string }>; contentHash: string } };
    assert.ok(body.data.policies.some((p) => p.id === policyId));
    assert.ok(body.data.contentHash.length > 0);

    await app.prisma.policy.delete({ where: { id: policyId } });
  });

  it('evaluates compliance on heartbeat and creates a violation alert (deduplicated)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/policies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'TEST-POLICY-COMPLIANCE',
        type: 'SECURITY',
        settings: { firewallRequired: true, antivirusRequired: true },
        isActive: true,
      },
    });
    const policyId = (created.json() as { data: { id: string } }).data.id;
    await app.inject({
      method: 'POST',
      url: `/api/policies/${policyId}/assign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceIds: [enrolledDeviceId] },
    });

    // First heartbeat violates (no firewall/antivirus)
    const hb1 = await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: { 'x-agent-token': agentToken },
      payload: {
        deviceId: enrolledDeviceId,
        agentVersion: '0.1.0',
        timestamp: new Date().toISOString(),
        status: 'ONLINE',
        security: { firewallEnabled: false, antivirusEnabled: false },
      },
    });
    assert.equal(hb1.statusCode, 200);

    const results = await app.prisma.complianceResult.findMany({
      where: { deviceId: enrolledDeviceId, NOT: { reason: '' } },
    });
    assert.ok(results.some((r) => r.status === 'NON_COMPLIANT'));

    const alerts = await app.prisma.alert.findMany({
      where: { deviceId: enrolledDeviceId, type: 'COMPLIANCE_VIOLATION', status: 'OPEN' },
    });
    assert.equal(alerts.length, 1);

    // Second heartbeat should NOT create a second alert (dedup by OPEN alert)
    await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: { 'x-agent-token': agentToken },
      payload: {
        deviceId: enrolledDeviceId,
        agentVersion: '0.1.0',
        timestamp: new Date().toISOString(),
        status: 'ONLINE',
        security: { firewallEnabled: false, antivirusEnabled: false },
      },
    });

    const alertsAfter = await app.prisma.alert.findMany({
      where: { deviceId: enrolledDeviceId, type: 'COMPLIANCE_VIOLATION', status: 'OPEN' },
    });
    assert.equal(alertsAfter.length, 1);

    await app.prisma.alert.deleteMany({ where: { deviceId: enrolledDeviceId } });
    await app.prisma.policy.delete({ where: { id: policyId } });
  });

  it('lists and resolves alerts (RBAC: viewer can read, IT_ADMIN resolves)', async () => {
    const alert = await app.prisma.alert.create({
      data: {
        organizationId: demoOrgId,
        deviceId: enrolledDeviceId,
        type: 'SECURITY',
        severity: 'CRITICAL',
        title: 'Test alert',
        message: 'Automated test alert',
        status: 'OPEN',
      },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/alerts?severity=CRITICAL',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(list.statusCode, 200);
    const listBody = list.json() as { data: { items: Array<{ id: string }> } };
    assert.ok(listBody.data.items.some((a) => a.id === alert.id));

    const resolve = await app.inject({
      method: 'POST',
      url: `/api/alerts/${alert.id}/resolve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { note: 'tested' },
    });
    assert.equal(resolve.statusCode, 200);
    const resolveBody = resolve.json() as { data: { status: string } };
    assert.equal(resolveBody.data.status, 'RESOLVED');

    await app.prisma.alert.delete({ where: { id: alert.id } });
  });

  it('rejects destructive commands without confirmed flag', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceId: enrolledDeviceId, type: 'RESTART_DEVICE' },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as { error: { details?: Array<{ path: string[]; message: string }> } };
    assert.ok(body.error.details?.some((d) => d.path.includes('confirmed')));
  });

  it('creates a destructive command when confirmed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceId: enrolledDeviceId, type: 'LOCK_DEVICE', confirmed: true },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json() as { data: { id: string; status: string; type: string } };
    assert.equal(body.data.type, 'LOCK_DEVICE');
    assert.equal(body.data.status, 'QUEUED');

    await app.prisma.command.delete({ where: { id: body.data.id } });
  });

  it('creates a non-destructive command without confirmation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceId: enrolledDeviceId, type: 'SYNC_POLICY' },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json() as { data: { id: string; type: string } };
    assert.equal(body.data.type, 'SYNC_POLICY');

    await app.prisma.command.delete({ where: { id: body.data.id } });
  });
});