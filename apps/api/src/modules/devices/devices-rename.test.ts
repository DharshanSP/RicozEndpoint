import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

describe('Device rename (PATCH /api/devices/:id)', () => {
  let app: FastifyInstance;
  let orgId: string;
  let otherOrgId: string;
  let adminToken: string;
  let viewerToken: string;
  let deviceId: string;
  const runId = Date.now();

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.create({ data: { name: `Rename-Test-${runId}` } });
    orgId = org.id;
    const other = await app.prisma.organization.create({ data: { name: `Rename-Foreign-${runId}` } });
    otherOrgId = other.id;

    const makeUser = async (email: string, role: 'ORG_ADMIN' | 'VIEWER') => {
      const user = await app.prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          name: email,
          passwordHash: await hashPassword('test1234'),
          role,
        },
      });
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: user.email, password: 'test1234' },
      });
      return (login.json() as LoginResponse).data!.token!;
    };
    adminToken = await makeUser(`rename-admin-${runId}@ricoz.local`, 'ORG_ADMIN');
    viewerToken = await makeUser(`rename-viewer-${runId}@ricoz.local`, 'VIEWER');

    const device = await app.prisma.device.create({
      data: {
        organizationId: orgId,
        deviceName: `RENAME-ME-${runId}`,
        hostname: `rename-me-${runId}`,
        serialNumber: `SN-RENAME-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        status: 'ONLINE',
        architecture: 'x64',
      },
    });
    deviceId = device.id;
  });

  after(async () => {
    await app.prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
    await app.prisma.device.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
    await app.prisma.user.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
    await app.close();
  });

  it('renames display name and hostname with an audit trail', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/devices/${deviceId}`,
      headers: auth(adminToken),
      payload: { deviceName: `RENAMED-${runId}`, hostname: `renamed-${runId}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { success: boolean; data: { deviceName: string; hostname: string } };
    assert.equal(body.data.deviceName, `RENAMED-${runId}`);
    assert.equal(body.data.hostname, `renamed-${runId}`);

    const stored = await app.prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    assert.equal(stored.deviceName, `RENAMED-${runId}`);

    const audit = await app.prisma.auditLog.findFirst({
      where: { organizationId: orgId, action: 'DEVICE_UPDATED', resourceId: deviceId },
    });
    assert.ok(audit, 'rename writes a DEVICE_UPDATED audit row');
  });

  it('rejects viewers, blank names and foreign devices', async () => {
    const viewer = await app.inject({
      method: 'PATCH',
      url: `/api/devices/${deviceId}`,
      headers: auth(viewerToken),
      payload: { deviceName: 'Nope' },
    });
    assert.equal(viewer.statusCode, 403);

    const blank = await app.inject({
      method: 'PATCH',
      url: `/api/devices/${deviceId}`,
      headers: auth(adminToken),
      payload: { deviceName: '  ' },
    });
    assert.ok([400, 422].includes(blank.statusCode), `expected validation failure, got ${blank.statusCode}`);

    const foreign = await app.prisma.device.create({
      data: {
        organizationId: otherOrgId,
        deviceName: `FOREIGN-${runId}`,
        hostname: `foreign-${runId}`,
        serialNumber: `SN-FOREIGN-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        status: 'ONLINE',
        architecture: 'x64',
      },
    });
    const cross = await app.inject({
      method: 'PATCH',
      url: `/api/devices/${foreign.id}`,
      headers: auth(adminToken),
      payload: { deviceName: 'Nope' },
    });
    assert.equal(cross.statusCode, 404);
  });
});
