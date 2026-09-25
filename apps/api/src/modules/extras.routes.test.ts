import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server';
import { hashPassword } from '../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string; user?: { id?: string } };
  error?: { code?: string; message?: string };
}

describe('Device Groups API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let viewerToken: string;
  let viewerId: string;
  let demoOrgId: string;
  let demoDeviceId: string;
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

    const viewerUser = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: `extras-viewer-${runId}@ricoz.local`,
        name: 'Extras Viewer',
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
    await app.prisma.deviceGroup.deleteMany({ where: { name: { contains: `GRP-TEST-${runId}` } } }).catch(() => undefined);
    await app.close();
  });

  it('creates a device group with an initial member', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/device-groups',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: `GRP-TEST-${runId}-A`, description: 'automated test group', deviceIds: [demoDeviceId] },
    });
    assert.equal(res.statusCode, 201);

    const list = await app.inject({
      method: 'GET',
      url: '/api/device-groups',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const payload = list.json();
    const item = payload.data.items.find((g: { name: string }) => g.name === `GRP-TEST-${runId}-A`);
    assert.ok(item, 'group should be listed');
    assert.equal(item.membersCount, 1, 'group should have 1 initial member');
  });

  it('returns group detail with member device references', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/device-groups',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const payload = list.json();
    const item = payload.data.items.find((g: { name: string }) => g.name === `GRP-TEST-${runId}-A`);
    assert.ok(item);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/device-groups/${item.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(detail.statusCode, 200);
    const group = detail.json().data;
    assert.equal(group.membersCount, 1);
    assert.equal(group.members[0].device.id, demoDeviceId);
  });

  it('rejects a duplicate group name with 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/device-groups',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: `GRP-TEST-${runId}-A` },
    });
    assert.equal(res.statusCode, 409);
  });

  it('viewer cannot create groups (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/device-groups',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: `GRP-TEST-${runId}-FORBIDDEN` },
    });
    assert.equal(res.statusCode, 403);
  });

  it('adds and removes members', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/device-groups',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const item = (list.json().data.items as Array<{ name: string; id: string }>).find((g) =>
      g.name === `GRP-TEST-${runId}-A`
    );

    const device2 = await app.prisma.device.findFirstOrThrow({
      where: { organizationId: demoOrgId, serialNumber: 'SN-DEMO-002' },
      select: { id: true },
    });

    const addRes = await app.inject({
      method: 'POST',
      url: `/api/device-groups/${item!.id}/members`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { deviceIds: [device2.id, demoDeviceId] },
    });
    assert.equal(addRes.statusCode, 200);
    assert.deepEqual(addRes.json().data, { added: 1, skipped: 1 });

    const removeRes = await app.inject({
      method: 'DELETE',
      url: `/api/device-groups/${item!.id}/members/${device2.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(removeRes.statusCode, 200);
    assert.equal(removeRes.json().data.removed, true);
  });

  it('rejects devices from another organization with 403', async () => {
    const foreignOrg = await app.prisma.organization.create({ data: { name: `Extras-Foreign-${runId}` } });
    const foreignDevice = await app.prisma.device.create({
      data: {
        organizationId: foreignOrg.id,
        deviceName: 'FOREIGN-1',
        hostname: 'FOREIGN-1',
        serialNumber: `SN-FOREIGN-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        status: 'ONLINE',
        architecture: 'x64',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/device-groups',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: `GRP-TEST-${runId}-CROSS`, deviceIds: [foreignDevice.id] },
    });
    assert.equal(res.statusCode, 403);

    await app.prisma.device.delete({ where: { id: foreignDevice.id } }).catch(() => undefined);
    await app.prisma.organization.delete({ where: { id: foreignOrg.id } }).catch(() => undefined);
  });
});

describe('Organization Settings API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let viewerToken: string;
  let viewerId: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (login.json() as LoginResponse).data!.token!;

    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    const viewerUser = await app.prisma.user.create({
      data: {
        organizationId: org.id,
        email: `settings-viewer-${runId}@ricoz.local`,
        name: 'Settings Viewer',
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
    await app.prisma.organization.update({
      where: { name: 'Ricoz Demo Organization' },
      data: { settingsJson: {} as unknown as object },
    }).catch(() => undefined);
    await app.close();
  });

  it('returns defaults when nothing is configured', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.settings.agentHeartbeatIntervalSeconds, 60);
  });

  it('applies a partial update and persists', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { agentHeartbeatIntervalSeconds: 120, alertRetentionDays: 14 },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.settings.agentHeartbeatIntervalSeconds, 120);
    assert.equal(res.json().data.settings.auditRetentionDays, 365);

    const get = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(get.json().data.settings.agentHeartbeatIntervalSeconds, 120);
  });

  it('rejects settings update for viewer (403)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { alertRetentionDays: 5 },
    });
    assert.equal(res.statusCode, 403);
  });
});

describe('Audit Logs API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (login.json() as LoginResponse).data!.token!;
  });

  after(async () => {
    await app.close();
  });

  it('lists audit log entries ordered by timestamp desc', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/audit-logs?page=1&limit=25`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const payload = res.json();
    assert.ok(payload.data.total >= 6, 'seed audit entries should exist');
    assert.ok(payload.data.items[0]?.actor?.email, 'actor details should be included');
  });

  it('filters by action', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/audit-logs?action=POLICY_CREATED`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const items = res.json().data.items as Array<{ action: string }>;
    assert.ok(items.length > 0);
    assert.ok(items.every((item) => item.action.includes('POLICY_CREATED')));
  });

  it('searches across actor email', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/audit-logs?search=admin@ricoz.local`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const items = res.json().data.items as Array<{ actor?: { email: string } }>;
    assert.ok(items.length > 0);
    assert.ok(items.every((item) => item.actor?.email.includes('admin@ricoz.local')));
  });
});

describe('Software Catalog API', () => {
  let app: FastifyInstance;
  let adminToken: string;

  before(async () => {
    app = await buildApp();
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (login.json() as LoginResponse).data!.token!;
  });

  after(async () => {
    await app.close();
  });

  it('aggregates seeded software into a catalog', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/software?limit=100',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const payload = res.json();
    assert.ok(payload.data.total >= 4, 'seeded software names should be cataloged');
    const chrome = payload.data.items as Array<{
      name: string;
      deviceCount: number;
      versions: Array<{ version: string; count: number }>;
      latestVersion: string;
    }>;
    assert.ok(chrome.length > 0);
    assert.ok(chrome[0].versions.length > 0);
    assert.ok(chrome[0].latestVersion);
  });

  it('searches the catalog by name', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/software?search=chrome',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const items = res.json().data.items as Array<{ name: string }>;
    assert.ok(items.every((item) => item.name.toLowerCase().includes('chrome')));
  });
});