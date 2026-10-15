import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

interface DashboardData {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  openAlertsCount: number;
  activeAlerts: Array<{ id: string; title: string }>;
  osDistribution: Array<{ name: string; count: number; percentage: number }>;
  patchSummary: { total: number; pending: number; approved: number; deployed: number; failedInstalls: number };
}

const get = (app: FastifyInstance, url: string, token: string) =>
  app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

describe('Dashboard API (patch strip, range semantics, scoping)', () => {
  let app: FastifyInstance;
  let orgId: string;
  let otherOrgId: string;
  let adminToken: string;
  let demoToken: string;
  let demoDeviceId: string;
  let realDeviceId: string;
  const runId = Date.now();
  const marker = `DASH-${runId}`;

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.create({ data: { name: `Dashboard-Test-${runId}` } });
    orgId = org.id;
    const other = await app.prisma.organization.create({ data: { name: `Dashboard-Foreign-${runId}` } });
    otherOrgId = other.id;

    const makeUser = async (email: string, role: 'ORG_ADMIN' | 'VIEWER', demo = false) => {
      const user = await app.prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          name: email,
          passwordHash: await hashPassword('test1234'),
          role,
          ...(demo ? { isDemoAccount: true } : {}),
        },
      });
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: user.email, password: 'test1234' },
      });
      return (login.json() as LoginResponse).data!.token!;
    };

    adminToken = await makeUser(`dash-admin-${runId}@ricoz.local`, 'ORG_ADMIN');
    demoToken = await makeUser(`dash-demo-${runId}@ricoz.local`, 'VIEWER', true);

    const makeDevice = (suffix: string, status: string, demo: boolean, os = 'Windows', osVersion = 'Windows 11') =>
      app.prisma.device.create({
        data: {
          organizationId: orgId,
          deviceName: `${marker}-DEV-${suffix}`,
          hostname: `${marker.toLowerCase()}-host-${suffix}`,
          serialNumber: `SN-${marker}-${suffix}`,
          os,
          osVersion,
          status,
          architecture: 'x64',
          ...(demo ? { isDemoSeed: true } : {}),
        },
      });

    demoDeviceId = (await makeDevice('DEMO', 'ONLINE', true)).id;
    realDeviceId = (await makeDevice('REAL', 'OFFLINE', false, 'Windows Server', 'Windows Server 2022')).id;
    await app.prisma.device.create({
      data: {
        organizationId: otherOrgId,
        deviceName: `${marker}-FOREIGN`,
        hostname: `${marker.toLowerCase()}-foreign`,
        serialNumber: `SN-${marker}-FOREIGN`,
        os: 'Windows',
        osVersion: 'Windows 11',
        status: 'ONLINE',
        architecture: 'x64',
      },
    });

    const old = new Date(Date.now() - 40 * 24 * 60 * 60_000);
    await app.prisma.alert.createMany({
      data: [
        {
          organizationId: orgId,
          deviceId: realDeviceId,
          type: 'DEVICE_OFFLINE',
          severity: 'WARNING',
          title: `${marker} recent offline`,
          message: 'recent probe',
          status: 'OPEN',
          dedupKey: `dash-recent-${runId}`,
        },
        {
          organizationId: orgId,
          deviceId: realDeviceId,
          type: 'DEVICE_OFFLINE',
          severity: 'WARNING',
          title: `${marker} stale offline`,
          message: 'old probe outside the 24h window',
          status: 'OPEN',
          dedupKey: `dash-stale-${runId}`,
          createdAt: old,
        },
        {
          organizationId: orgId,
          deviceId: demoDeviceId,
          type: 'DEVICE_OFFLINE',
          severity: 'WARNING',
          title: `${marker} demo offline`,
          message: 'demo probe',
          status: 'OPEN',
          dedupKey: `dash-demo-${runId}`,
        },
      ],
    });

    const patch = await app.prisma.patch.create({
      data: {
        organizationId: orgId,
        kbNumber: `KB9${String(runId).slice(-7)}`,
        title: `${marker} failing patch`,
        severity: 'CRITICAL',
      },
    });
    await app.prisma.devicePatch.create({
      data: {
        deviceId: realDeviceId,
        patchId: patch.id,
        status: 'FAILED',
        lastReportedAt: new Date(),
      },
    });
    await app.prisma.command.create({
      data: {
        organizationId: orgId,
        deviceId: realDeviceId,
        type: 'INSTALL_PATCH',
        status: 'FAILED',
        patchId: patch.id,
        errorMessage: 'exit code 1603',
        completedAt: new Date(),
      },
    });

    await app.prisma.complianceResult.create({
      data: {
        deviceId: realDeviceId,
        status: 'NON_COMPLIANT',
        reason: 'dashboard probe',
        evaluatedAt: new Date(),
      },
    });
  });

  after(async () => {
    await app.prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
    await app.prisma.command.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
    await app.prisma.alert.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
    await app.prisma.complianceResult.deleteMany({ where: { device: { organizationId: orgId } } });
    await app.prisma.devicePatch.deleteMany({ where: { device: { organizationId: orgId } } });
    await app.prisma.patch.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.device.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
    await app.prisma.user.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
    await app.close();
  });

  const dashboard = async (token: string, range = '24h'): Promise<DashboardData> => {
    const res = await get(app, `/api/dashboard?range=${range}`, token);
    assert.equal(res.statusCode, 200);
    return (res.json() as { success: boolean; data: DashboardData }).data;
  };

  it('serves fleet counts from real rows with an org-wide unresolved total', async () => {
    const data = await dashboard(adminToken);
    assert.equal(data.totalDevices, 2);
    assert.equal(data.onlineDevices, 1);
    assert.equal(data.offlineDevices, 1);
    assert.ok(data.openAlertsCount >= 3, `expected all-time unresolved total, got ${data.openAlertsCount}`);
  });

  it('windows the alert stream by range while counts stay all-time', async () => {
    const data = await dashboard(adminToken, '24h');
    const titles = data.activeAlerts.map((a) => a.title);
    assert.ok(titles.some((t) => t.includes('recent offline')));
    assert.ok(!titles.some((t) => t.includes('stale offline')), '40-day-old alert must be outside the 24h stream');
  });

  it('groups OS distribution by family and version without merging', async () => {
    const data = await dashboard(adminToken);
    assert.equal(data.osDistribution.length, 2);
    const byName = new Map(data.osDistribution.map((r) => [r.name, r.count]));
    assert.equal(byName.get('Windows 11'), 1);
    assert.equal(byName.get('Windows Server 2022'), 1);
    assert.equal(
      data.osDistribution.reduce((sum, r) => sum + r.count, 0),
      data.totalDevices
    );
  });

  it('exposes the patch posture strip', async () => {    const data = await dashboard(adminToken);
    assert.ok(data.patchSummary, 'patchSummary must be present');
    assert.ok(data.patchSummary.total >= 1);
    assert.ok(data.patchSummary.failedInstalls >= 1, 'failed DevicePatch rows must be counted');
    assert.equal(
      data.patchSummary.pending + data.patchSummary.approved + data.patchSummary.deployed,
      data.patchSummary.total
    );
  });

  it('gives SUPER_ADMIN the cross-tenant view', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    const superToken = (login.json() as LoginResponse).data!.token!;
    const data = await dashboard(superToken);
    assert.ok(
      data.totalDevices >= 3,
      `SUPER_ADMIN must see both tenants, got ${data.totalDevices}`
    );
  });

  it('restricts demo logins to demo-seeded devices', async () => {
    const data = await dashboard(demoToken);
    assert.equal(data.totalDevices, 1);
    assert.equal(data.onlineDevices, 1);
    assert.equal(data.offlineDevices, 0);
    assert.equal(data.openAlertsCount, 1);
    assert.ok(data.activeAlerts.every((a) => a.title.includes('demo offline')));
  });
});
