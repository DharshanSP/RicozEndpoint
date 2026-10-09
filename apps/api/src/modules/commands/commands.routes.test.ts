import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

describe('Commands RBAC — Operator safe actions, Viewer read-only', () => {
  let app: FastifyInstance;
  let orgId: string;
  let deviceId: string;
  let operatorToken: string;
  let viewerToken: string;
  let adminToken: string;
  const createdCommandIds: string[] = [];

  before(async () => {
    app = await buildApp();
    const runId = Date.now();

    const org = await app.prisma.organization.create({
      data: { name: `Commands RBAC Org ${runId}` },
    });
    orgId = org.id;

    const mkUser = async (email: string, role: 'IT_ADMIN' | 'OPERATOR' | 'VIEWER') =>
      app.prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          name: email,
          passwordHash: await hashPassword('test12345'),
          role,
        },
      });

    const admin = await mkUser(`cmd-admin-${runId}@ricoz.local`, 'IT_ADMIN');
    const operator = await mkUser(`cmd-operator-${runId}@ricoz.local`, 'OPERATOR');
    const viewer = await mkUser(`cmd-viewer-${runId}@ricoz.local`, 'VIEWER');

    const device = await app.prisma.device.create({
      data: {
        organizationId: orgId,
        deviceName: 'CMD-RBAC-DEV',
        hostname: 'CMD-RBAC-DEV',
        serialNumber: `SN-CMD-RBAC-${runId}`,
        manufacturer: 'Test',
        model: 'VM-1',
        os: 'Windows',
        osVersion: 'Windows 11 Pro 23H2',
        architecture: 'x64',
        ipAddress: '10.0.0.9',
        agentVersion: '0.1.0',
        status: 'ONLINE',
        lastSeenAt: new Date(),
      },
    });
    deviceId = device.id;

    const login = async (email: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password: 'test12345' },
      });
      const body = res.json() as LoginResponse;
      assert.equal(res.statusCode, 200);
      assert.ok(body.data?.token);
      return body.data!.token as string;
    };

    adminToken = await login(admin.email);
    operatorToken = await login(operator.email);
    viewerToken = await login(viewer.email);
  });

  after(async () => {
    if (createdCommandIds.length > 0) {
      await app.prisma.command.deleteMany({ where: { id: { in: createdCommandIds } } });
    }
    if (orgId) {
      await app.prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
      await app.prisma.command.deleteMany({ where: { organizationId: orgId } });
      await app.prisma.device.deleteMany({ where: { organizationId: orgId } });
      await app.prisma.user.deleteMany({ where: { organizationId: orgId } });
      await app.prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    }
    await app.close();
  });

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  it('VIEWER can list commands but cannot issue any (403)', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/commands',
      headers: auth(viewerToken),
    });
    assert.equal(list.statusCode, 200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: auth(viewerToken),
      payload: { deviceId, type: 'REFRESH_INVENTORY', confirmed: false },
    });
    assert.equal(create.statusCode, 403);
  });

  it('OPERATOR can issue approved safe commands', async () => {
    for (const type of ['REFRESH_INVENTORY', 'SYNC_POLICY'] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/commands',
        headers: auth(operatorToken),
        payload: { deviceId, type, confirmed: false },
      });
      assert.equal(res.statusCode, 201, `${type} should be allowed for OPERATOR`);
      const body = res.json() as { data?: { id?: string } };
      if (body.data?.id) createdCommandIds.push(body.data.id);
    }
  });

  it('OPERATOR is blocked from destructive commands even with confirmed:true (403)', async () => {
    for (const type of ['LOCK_DEVICE', 'RESTART_DEVICE', 'SHUTDOWN_DEVICE'] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/commands',
        headers: auth(operatorToken),
        payload: { deviceId, type, confirmed: true },
      });
      assert.equal(res.statusCode, 403, `${type} must be IT_ADMIN+`);
    }
  });

  it('OPERATOR can cancel safe commands but not destructive ones', async () => {
    const safe = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: auth(operatorToken),
      payload: { deviceId, type: 'REFRESH_INVENTORY', confirmed: false },
    });
    assert.equal(safe.statusCode, 201);
    const safeId = (safe.json() as { data: { id: string } }).data.id;
    createdCommandIds.push(safeId);

    const cancelSafe = await app.inject({
      method: 'POST',
      url: `/api/commands/${safeId}/cancel`,
      headers: auth(operatorToken),
    });
    assert.equal(cancelSafe.statusCode, 200);

    const destructive = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: auth(adminToken),
      payload: { deviceId, type: 'RESTART_DEVICE', confirmed: true },
    });
    assert.equal(destructive.statusCode, 201);
    const destructiveId = (destructive.json() as { data: { id: string } }).data.id;
    createdCommandIds.push(destructiveId);

    const cancelDestructive = await app.inject({
      method: 'POST',
      url: `/api/commands/${destructiveId}/cancel`,
      headers: auth(operatorToken),
    });
    assert.equal(cancelDestructive.statusCode, 403);
  });

  it('IT_ADMIN can issue destructive commands with confirmed:true (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: auth(adminToken),
      payload: { deviceId, type: 'LOCK_DEVICE', confirmed: true },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json() as { data?: { id?: string } };
    if (body.data?.id) createdCommandIds.push(body.data.id);
  });
});
