import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
  error?: { code?: string; message?: string };
}

interface TokenResponse {
  success: boolean;
  data?: { token?: string; id?: string; isActive?: boolean };
  error?: { code?: string; message?: string };
}

interface EnrollResponse {
  success: boolean;
  data?: { deviceId?: string; agentToken?: string; status?: string };
  error?: { code?: string; message?: string };
}

describe('Device Enrollment API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let operatorToken: string;
  let demoOrgId: string;
  const cleanupEnrollmentIds: string[] = [];
  const cleanupDeviceIds: string[] = [];
  const runId = Date.now();

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    demoOrgId = org.id;

    async function login(email: string, password: string): Promise<string> {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password },
      });
      const body = res.json() as LoginResponse;
      assert.ok(res.statusCode === 200 && body.data?.token, `${email} should log in`);
      return body.data!.token!;
    }

    adminToken = await login('admin@ricoz.local', 'admin123');
    operatorToken = await login('operator@ricoz.local', 'operator123');
  });

  after(async () => {
    for (const id of cleanupEnrollmentIds) {
      await app.prisma.enrollmentToken.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of cleanupDeviceIds) {
      await app.prisma.enrollmentToken.deleteMany({ where: { deviceId: id } });
      await app.prisma.device.delete({ where: { id } }).catch(() => undefined);
    }
    await app.close();
  });

  function headers(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  async function createToken(
    token: string,
    body?: Record<string, unknown>,
  ): Promise<TokenResponse & { statusCode: number }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/enrollment-tokens',
      headers: headers(token),
      payload: body ?? {},
    });
    const json = res.json() as TokenResponse;
    if (res.statusCode === 201 && json.data?.id) {
      cleanupEnrollmentIds.push(json.data.id);
    }
    return { ...json, statusCode: res.statusCode };
  }

  async function enroll(body: Record<string, unknown>): Promise<EnrollResponse & { statusCode: number }> {
    const res = await app.inject({ method: 'POST', url: '/api/enroll', payload: body });
    return { ...(res.json() as EnrollResponse), statusCode: res.statusCode };
  }

  async function cleanupDevice(serialNumber: string): Promise<void> {
    const device = await app.prisma.device.findUnique({
      where: { organizationId_serialNumber: { organizationId: demoOrgId, serialNumber } },
      select: { id: true },
    });
    if (device) {
      cleanupDeviceIds.push(device.id);
      await app.prisma.enrollmentToken.deleteMany({ where: { deviceId: device.id } });
    }
  }

  it('rejects unauthenticated access to enrollment-token endpoints', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/enrollment-tokens' });
    assert.equal(res.statusCode, 401);
  });

  it('blocks OPERATOR from creating enrollment tokens (RBAC)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/enrollment-tokens',
      headers: headers(operatorToken),
      payload: {},
    });
    assert.equal(res.statusCode, 403);
  });

  it('creates an enrollment token returning the single-use code', async () => {
    const res = await createToken(adminToken, { label: 'test-agent-a' });
    assert.equal(res.statusCode, 201);
    assert.ok(res.data?.token && res.data.token.startsWith('rich_'), 'returns raw enrollment code');
  });

  it('rejects enrollment with an invalid token', async () => {
    const res = await enroll({
      enrollmentToken: 'rich_not-a-real-token',
      hostname: 'INVALID-TEST',
      serialNumber: `SN-${runId}-INVALID`,
      os: 'Windows',
      osVersion: 'Windows 11 Pro 24H2',
      agentVersion: '0.1.0',
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.error?.code, 'INVALID_ENROLLMENT_TOKEN');
  });

  it('accepts an existing device serial on re-enrollment', async () => {
    const token = await createToken(adminToken, { label: 're-enroll' });
    const first = await enroll({
      enrollmentToken: token.data!.token,
      hostname: 'RE-ENROLL-HOST',
      serialNumber: `SN-${runId}-RENROLL`,
      os: 'Windows',
      osVersion: 'Windows 11 Pro 24H2',
      agentVersion: '0.1.0',
    });
    assert.equal(first.statusCode, 201);
    assert.ok(first.data?.deviceId);
    await cleanupDevice(`SN-${runId}-RENROLL`);

    const token2 = await createToken(adminToken, { label: 're-enroll-2' });
    const second = await enroll({
      enrollmentToken: token2.data!.token,
      hostname: 'RE-ENROLL-HOST-2',
      serialNumber: `SN-${runId}-RENROLL`,
      os: 'Windows',
      osVersion: 'Windows 11 Pro 24H2',
      agentVersion: '0.1.1',
    });
    assert.equal(second.statusCode, 201);
    assert.equal(second.data?.deviceId, first.data?.deviceId, 're-enroll reuses the same device');
  });

  it('consumes a single-use token after one enrollment', async () => {
    const token = await createToken(adminToken, { label: 'single-use', maxUses: 1 });
    const first = await enroll({
      enrollmentToken: token.data!.token,
      hostname: 'SINGLE-USE-HOST',
      serialNumber: `SN-${runId}-SINGLE`,
      os: 'Windows',
      osVersion: 'Windows 10',
      agentVersion: '0.1.0',
    });
    assert.equal(first.statusCode, 201);
    await cleanupDevice(`SN-${runId}-SINGLE`);

    const second = await enroll({
      enrollmentToken: token.data!.token,
      hostname: 'SINGLE-USE-HOST-2',
      serialNumber: `SN-${runId}-SINGLE-2`,
      os: 'Windows',
      osVersion: 'Windows 10',
      agentVersion: '0.1.0',
    });
    assert.equal(second.statusCode, 401, 'consumed token must be rejected');
  });

  it('rejects expired enrollment tokens', async () => {
    const token = await createToken(adminToken, {
      label: 'expired',
      expiresAt: '2020-01-01T00:00:00.000Z',
      maxUses: 5,
    });
    const res = await enroll({
      enrollmentToken: token.data!.token,
      hostname: 'EXPIRED-HOST',
      serialNumber: `SN-${runId}-EXPIRED`,
      os: 'Windows',
      osVersion: 'Windows 10',
      agentVersion: '0.1.0',
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.error?.code, 'ENROLLMENT_TOKEN_EXPIRED');
  });

  it('attaches enrollment to a pre-provisioned device when deviceId is bound', async () => {
    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    const preDevice = await app.prisma.device.create({
      data: {
        organizationId: org.id,
        deviceName: 'PREPROV-HOST',
        hostname: 'PREPROV-HOST',
        serialNumber: `SN-${runId}-PREPROV`,
        manufacturer: 'Dell',
        model: 'Latitude 7440',
        os: 'Windows',
        osVersion: 'Windows 11 Pro 23H2',
        architecture: 'x64',
        ipAddress: '192.168.10.50',
        agentVersion: '0.1.0',
        status: 'PENDING',
      },
    });
    cleanupDeviceIds.push(preDevice.id);

    const token = await createToken(adminToken, { label: 'preprovisioned', deviceId: preDevice.id });
    const res = await enroll({
      enrollmentToken: token.data!.token,
      hostname: 'PREPROV-HOST-NEW',
      serialNumber: `SN-${runId}-PREPROV`,
      os: 'Windows',
      osVersion: 'Windows 11 Pro 24H2',
      agentVersion: '0.2.0',
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.data?.deviceId, preDevice.id, 'agent must attach to pre-provisioned device');

    const reloaded = await app.prisma.device.findUniqueOrThrow({ where: { id: preDevice.id } });
    assert.equal(reloaded.osVersion, 'Windows 11 Pro 24H2', 'device identity refreshed on enroll');
    assert.equal(reloaded.agentVersion, '0.2.0');
  });

  it('revokes an enrollment token and rejects later enrollment', async () => {
    const token = await createToken(adminToken, { label: 'to-revoke', maxUses: 5 });
    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/enrollment-tokens/${token.data!.id}`,
      headers: headers(adminToken),
    });
    assert.equal(revoke.statusCode, 200);

    const res = await enroll({
      enrollmentToken: token.data!.token,
      hostname: 'REVOKED-HOST',
      serialNumber: `SN-${runId}-REVOKED`,
      os: 'Windows',
      osVersion: 'Windows 10',
      agentVersion: '0.1.0',
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.error?.code, 'INVALID_ENROLLMENT_TOKEN');
  });

  it('lists enrollment tokens for the caller organization', async () => {
    await createToken(adminToken, { label: `listable-${runId}` });
    const res = await app.inject({
      method: 'GET',
      url: '/api/enrollment-tokens?limit=100',
      headers: headers(adminToken),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data?: { label: string }[] };
    assert.ok(body.data?.some((t) => t.label === `listable-${runId}`));
  });

  it('scopes enrollment tokens to the caller organization for non-super roles', async () => {
    const org = await app.prisma.organization.create({
      data: { name: `Enrollment Org ${runId}` },
    });
    const device = await app.prisma.device.create({
      data: {
        organizationId: org.id,
        deviceName: 'ENCAP-HOST',
        hostname: 'ENCAP-HOST',
        serialNumber: `SN-${runId}-ENCAP`,
        manufacturer: 'Test',
        model: 'VM-2',
        os: 'Windows',
        osVersion: 'Windows 10',
        architecture: 'x64',
        agentVersion: '0.1.0',
        status: 'ONLINE',
      },
    });

    const token = await app.prisma.enrollmentToken.create({
      data: { organizationId: org.id, tokenHash: `hash-${runId}-${Math.random()}`, label: 'encapsulated' },
    });
    cleanupEnrollmentIds.push(token.id);
    cleanupDeviceIds.push(device.id);

    const asOperator = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'operator@ricoz.local', password: 'operator123' },
    });
    const operatorBody = asOperator.json() as LoginResponse;
    assert.ok(asOperator.statusCode === 200 && operatorBody.data?.token);

    const res = await app.inject({
      method: 'GET',
      url: '/api/enrollment-tokens?limit=100&includeRevoked=true',
      headers: headers(operatorBody.data!.token!),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data?: { label: string }[] };
    assert.ok(!body.data?.some((t) => t.label === 'encapsulated'), 'operator must not see foreign org tokens');

    const asAdmin = await app.inject({
      method: 'GET',
      url: '/api/enrollment-tokens?limit=100&includeRevoked=true',
      headers: headers(adminToken),
    });
    const adminBody = asAdmin.json() as { data?: { label: string }[] };
    assert.ok(adminBody.data?.some((t) => t.label === 'encapsulated'), 'SUPER_ADMIN sees tokens of all orgs');
  });
});