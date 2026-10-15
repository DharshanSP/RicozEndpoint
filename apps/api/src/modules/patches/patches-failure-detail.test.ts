import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

interface DetailDeviceRow {
  id: string;
  patchStatus: string;
  installedAt: string | null;
  lastReportedAt: string | null;
  command: {
    id: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
}

interface DetailData {
  summary: { totalDevices: number; installed: number; failed: number; missing: number; inFlight: number };
  devices: DetailDeviceRow[];
}

describe('Patch detail failure troubleshooting', () => {
  let app: FastifyInstance;
  let orgId: string;
  let adminToken: string;
  let patchId: string;
  let failedDeviceId: string;
  let pendingDeviceId: string;
  const runId = Date.now();

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.create({ data: { name: `PatchFail-Test-${runId}` } });
    orgId = org.id;

    const user = await app.prisma.user.create({
      data: {
        organizationId: orgId,
        email: `patchfail-admin-${runId}@ricoz.local`,
        name: 'PatchFail Admin',
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

    const makeDevice = (suffix: string) =>
      app.prisma.device.create({
        data: {
          organizationId: orgId,
          deviceName: `PATCHFAIL-${suffix}-${runId}`,
          hostname: `patchfail-${suffix}-${runId}`,
          serialNumber: `SN-PATCHFAIL-${suffix}-${runId}`,
          os: 'Windows',
          osVersion: 'Windows 11',
          status: 'ONLINE',
          architecture: 'x64',
        },
      });

    failedDeviceId = (await makeDevice('FAILED')).id;
    pendingDeviceId = (await makeDevice('PENDING')).id;

    const patch = await app.prisma.patch.create({
      data: {
        organizationId: orgId,
        kbNumber: `KB3${String(runId).slice(-7)}`,
        title: 'Failing patch probe',
        severity: 'CRITICAL',
      },
    });
    patchId = patch.id;

    const reportedAt = new Date(Date.now() - 60_000);
    await app.prisma.devicePatch.create({
      data: {
        deviceId: failedDeviceId,
        patchId,
        status: 'FAILED',
        lastReportedAt: reportedAt,
      },
    });

    // Stale in-flight row must lose to the newer terminal failure.
    await app.prisma.command.create({
      data: {
        organizationId: orgId,
        deviceId: failedDeviceId,
        type: 'INSTALL_PATCH',
        status: 'QUEUED',
        patchId,
        createdAt: new Date(Date.now() - 120_000),
      },
    });
    await app.prisma.command.create({
      data: {
        organizationId: orgId,
        deviceId: failedDeviceId,
        type: 'INSTALL_PATCH',
        status: 'FAILED',
        patchId,
        errorMessage: 'exit code 1603: fatal error during installation',
        createdAt: new Date(Date.now() - 90_000),
        completedAt: reportedAt,
      },
    });
    await app.prisma.command.create({
      data: {
        organizationId: orgId,
        deviceId: pendingDeviceId,
        type: 'INSTALL_PATCH',
        status: 'QUEUED',
        patchId,
      },
    });
  });

  after(async () => {
    await app.prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.command.deleteMany({ where: { patchId } });
    await app.prisma.devicePatch.deleteMany({ where: { patchId } });
    await app.prisma.patch.deleteMany({ where: { id: patchId } });
    await app.prisma.device.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.user.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    await app.close();
  });

  it('surfaces the latest terminal failure with error text and timestamps', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/patches/${patchId}`,
      headers: auth(adminToken),
    });
    assert.equal(res.statusCode, 200);
    const data = (res.json() as { success: boolean; data: DetailData }).data;

    assert.deepEqual(
      { installed: data.summary.installed, failed: data.summary.failed, missing: data.summary.missing },
      { installed: 0, failed: 1, missing: 1 }
    );
    assert.equal(data.summary.inFlight, 1, 'only the QUEUED command counts as in-flight');

    const failed = data.devices.find((d) => d.id === failedDeviceId)!;
    assert.ok(failed, 'failed device row present');
    assert.equal(failed.patchStatus, 'FAILED');
    assert.ok(failed.command, 'latest command attached');
    assert.equal(failed.command.status, 'FAILED');
    assert.equal(failed.command.errorMessage, 'exit code 1603: fatal error during installation');
    assert.ok(failed.command.completedAt, 'completion timestamp present');
    assert.ok(failed.lastReportedAt, 'last-reported timestamp present');

    const pending = data.devices.find((d) => d.id === pendingDeviceId)!;
    assert.equal(pending.patchStatus, 'MISSING');
    assert.equal(pending.command?.status, 'QUEUED');
  });

  it('reports the FAILED state with timestamps on the per-device patch list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/patches/device/${failedDeviceId}`,
      headers: auth(adminToken),
    });
    assert.equal(res.statusCode, 200);
    const data = res.json() as {
      success: boolean;
      data: {
        summary: { failed: number };
        items: Array<{ deviceStatus: string; lastReportedAt: string | null }>;
      };
    };
    assert.equal(data.data.summary.failed, 1);
    const row = data.data.items.find((i) => i.deviceStatus === 'FAILED');
    assert.ok(row, 'FAILED row present on device list');
    assert.ok(row.lastReportedAt, 'last-reported timestamp present');
  });
});
