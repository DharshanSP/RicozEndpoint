import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

interface DeviceListData {
  data: Array<{ id: string; hostname: string; deviceName: string; registeredAt: string }>;
  pagination: { total: number };
}

const get = (app: FastifyInstance, url: string, token: string) =>
  app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

describe('Device list filters (group, registeredAt sort, case-insensitive search)', () => {
  let app: FastifyInstance;
  let orgId: string;
  let adminToken: string;
  let groupId: string;
  let deviceAId: string;
  let deviceBId: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.create({ data: { name: `DeviceFilter-Test-${runId}` } });
    orgId = org.id;

    const user = await app.prisma.user.create({
      data: {
        organizationId: orgId,
        email: `devfilter-admin-${runId}@ricoz.local`,
        name: 'DevFilter Admin',
        passwordHash: await hashPassword('test1234'),
        role: 'ORG_ADMIN',
      },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: 'test1234' },
    });
    adminToken = (login.json() as LoginResponse).data!.token!;

    const old = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const recent = new Date(Date.now() - 24 * 60 * 60_000);
    const makeDevice = (suffix: string, hostname: string, os: string, registeredAt: Date) =>
      app.prisma.device.create({
        data: {
          organizationId: orgId,
          deviceName: `FILTER-${suffix}-${runId}`,
          hostname,
          serialNumber: `SN-FILTER-${suffix}-${runId}`,
          os,
          osVersion: 'Windows 11',
          status: 'ONLINE',
          architecture: 'x64',
          registeredAt,
        },
      });

    // Mixed case on purpose: search must match regardless of case.
    deviceAId = (await makeDevice('A', `WEBSERVER01-${runId}`, 'Windows', old)).id;
    deviceBId = (await makeDevice('B', `webserver02-${runId}`, 'windows', recent)).id;
    await makeDevice('C', `dbserver01-${runId}`, 'Windows Server', recent);

    const group = await app.prisma.deviceGroup.create({
      data: { organizationId: orgId, name: `Web Tier ${runId}` },
    });
    groupId = group.id;
    await app.prisma.deviceGroupMember.create({ data: { groupId, deviceId: deviceAId } });
  });

  after(async () => {
    await app.prisma.deviceGroupMember.deleteMany({ where: { groupId } });
    await app.prisma.deviceGroup.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.device.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.user.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    await app.close();
  });

  const list = async (qs: string): Promise<DeviceListData> => {
    const res = await get(app, `/api/devices/${qs}`, adminToken);
    assert.equal(res.statusCode, 200);
    return res.json() as DeviceListData;
  };

  it('matches search case-insensitively across hostname and os', async () => {
    const lower = await list(`?search=${encodeURIComponent(`webserver0`)}`);
    const ids = lower.data.map((d) => d.id);
    assert.ok(ids.includes(deviceAId), 'uppercase hostname matches lowercase query');
    assert.ok(ids.includes(deviceBId), 'lowercase hostname matches lowercase query');

    const upperOs = await list(`?search=${encodeURIComponent('WINDOWS')}`);
    assert.ok(
      upperOs.data.some((d) => d.id === deviceBId),
      'lowercase os matches uppercase query'
    );
  });

  it('sorts by registeredAt instead of silently falling back', async () => {
    const body = await list('?sortBy=registeredAt&sortOrder=desc&limit=100');
    const ids = body.data.map((d) => d.id);
    const posA = ids.indexOf(deviceAId);
    const posB = ids.indexOf(deviceBId);
    assert.ok(posA !== -1 && posB !== -1, 'both fixtures listed');
    assert.ok(posB < posA, 'newer registeredAt sorts first under desc');
  });

  it('filters members by groupId and rejects malformed ids', async () => {
    const body = await list(`?groupId=${groupId}&limit=100`);
    assert.deepEqual(body.data.map((d) => d.id), [deviceAId]);

    const bad = await get(app, '/api/devices/?groupId=not-a-uuid', adminToken);
    assert.equal(bad.statusCode, 400);
  });
});
