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

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

interface PatchListData {
  items: Array<{
    id: string;
    kbNumber: string;
    severity: string;
    status: string;
    installedCount: number;
    totalDevices: number;
    affectedDevices: number;
  }>;
  total: number;
  summary: {
    total: number;
    critical: number;
    upToDatePercent: number | null;
  };
}

interface PatchDetailData {
  id: string;
  kbNumber: string;
  status: string;
  summary: { totalDevices: number; installed: number; failed: number; missing: number; inFlight: number };
  devices: Array<{ id: string; patchStatus: string; command: { id: string; status: string } | null }>;
}

interface DevicePatchData {
  summary: { total: number; installed: number; failed: number; missing: number };
  items: Array<{ kbNumber: string; deviceStatus: string }>;
}

interface DeployData {
  queued: number;
  skippedInstalled: number;
  skippedInFlight: number;
  deviceIds: string[];
  patch: { status: string };
}

describe('Patch management API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let viewerToken: string;
  let operatorToken: string;
  let demoOrgId: string;
  let deviceId: string;
  let agentToken: string;
  let foreignPatchId: string;

  const runId = Date.now();
  const KB_A = `KB9${String(runId).slice(-7)}`; // reported installed by the agent
  const KB_B = `KB8${String(runId).slice(-7)}`; // reported then uninstalled
  const KB_C = `KB7${String(runId).slice(-7)}`; // never reported -> deploy target
  const KB_D = `KB6${String(runId).slice(-7)}`; // manually created
  const KB_E = `KB4${String(runId).slice(-7)}`; // approved through PATCH
  const ourKbs = [KB_A, KB_B, KB_C, KB_D, KB_E];

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  const heartbeat = (patches?: Array<Record<string, unknown>>) =>
    app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: { 'x-agent-token': agentToken },
      payload: {
        deviceId,
        agentVersion: '0.1.0',
        timestamp: new Date().toISOString(),
        status: 'ONLINE',
        ...(patches ? { patches: { items: patches } } : {}),
      },
    });

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

    // Drop leftovers from a previous run so KB uniqueness holds.
    await app.prisma.patch
      .deleteMany({ where: { organizationId: demoOrgId, kbNumber: { in: ourKbs } } })
      .catch(() => undefined);

    // Deploy target that the agent never reports as installed.
    await app.prisma.patch.upsert({
      where: { organizationId_kbNumber: { organizationId: demoOrgId, kbNumber: KB_C } },
      create: { organizationId: demoOrgId, kbNumber: KB_C, title: 'Deploy target', severity: 'IMPORTANT' },
      update: { title: 'Deploy target' },
    });

    // Disposable accounts: never mutate the shared seed credentials, so
    // parallel test files are not affected by password changes made here.
    const viewerUser = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: `patches-viewer-${runId}@ricoz.local`,
        name: 'Patches Viewer',
        passwordHash: await hashPassword('viewer123'),
        role: 'VIEWER',
      },
    });
    viewerToken = await login(viewerUser.email, 'viewer123');

    const operatorUser = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: `patches-operator-${runId}@ricoz.local`,
        name: 'Patches Operator',
        passwordHash: await hashPassword('operator123'),
        role: 'OPERATOR',
      },
    });
    operatorToken = await login(operatorUser.email, 'operator123');

    const tokenRes = await app.inject({
      method: 'POST',
      url: '/api/enrollment-tokens',
      headers: auth(adminToken),
      payload: { label: `patches-test-${runId}`, maxUses: 1 },
    });
    const token = (tokenRes.json() as Envelope<{ token: string }>).data!.token;

    const enrollRes = await app.inject({
      method: 'POST',
      url: '/api/enroll',
      payload: {
        enrollmentToken: token,
        hostname: 'PATCHES-TEST-HOST',
        serialNumber: `SN-PATCHES-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        agentVersion: '0.1.0',
      },
    });
    const enrollBody = enrollRes.json() as Envelope<{ deviceId: string; agentToken: string }>;
    assert.equal(enrollRes.statusCode, 201);
    deviceId = enrollBody.data!.deviceId;
    agentToken = enrollBody.data!.agentToken;

    const foreignOrg = await app.prisma.organization.create({
      data: { name: `Patches Foreign Org ${runId}` },
    });
    const foreignPatch = await app.prisma.patch.create({
      data: {
        organizationId: foreignOrg.id,
        kbNumber: `KB5${String(runId).slice(-7)}`,
        title: 'Foreign tenant patch',
        severity: 'CRITICAL',
      },
    });
    foreignPatchId = foreignPatch.id;
  });

  after(async () => {
    if (deviceId) {
      await app.prisma.command.deleteMany({ where: { deviceId } }).catch(() => undefined);
      await app.prisma.devicePatch.deleteMany({ where: { deviceId } }).catch(() => undefined);
      await app.prisma.device.delete({ where: { id: deviceId } }).catch(() => undefined);
    }
    await app.prisma.patch
      .deleteMany({ where: { organizationId: demoOrgId, kbNumber: { in: ourKbs } } })
      .catch(() => undefined);
    if (foreignPatchId) {
      const patch = await app.prisma.patch
        .findUnique({ where: { id: foreignPatchId }, select: { organizationId: true } })
        .catch(() => null);
      if (patch) {
        await app.prisma.devicePatch.deleteMany({ where: { patchId: foreignPatchId } }).catch(() => undefined);
        await app.prisma.patch.delete({ where: { id: foreignPatchId } }).catch(() => undefined);
        await app.prisma.organization.delete({ where: { id: patch.organizationId } }).catch(() => undefined);
      }
    }
    await app.prisma.user
      .deleteMany({
        where: { email: { in: [`patches-viewer-${runId}@ricoz.local`, `patches-operator-${runId}@ricoz.local`] } },
      })
      .catch(() => undefined);
    await app.close();
  });

  // ── Catalog CRUD ────────────────────────────────────────────────────────────

  it('creates a patch and normalises the KB number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/patches',
      headers: auth(adminToken),
      payload: { kbNumber: KB_D.toLowerCase(), title: 'Manually catalogued update', severity: 'IMPORTANT' },
    });
    const body = res.json() as Envelope<{ kbNumber: string; status: string }>;
    assert.equal(res.statusCode, 201);
    assert.equal(body.data?.kbNumber, KB_D.toUpperCase());
    assert.equal(body.data?.status, 'PENDING');
  });

  it('rejects a KB number that is not in KB1234567 form', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/patches',
      headers: auth(adminToken),
      payload: { kbNumber: 'not-a-kb', title: 'Bad identifier' },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as Envelope<unknown>;
    assert.equal(body.error?.code, 'VALIDATION_ERROR');
    assert.match(body.error?.message ?? '', /KB\d+/);
  });

  it('rejects a duplicate KB number in the same organization', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/patches',
      headers: auth(adminToken),
      payload: { kbNumber: KB_D, title: 'Duplicate' },
    });
    assert.equal(res.statusCode, 409);
    assert.equal((res.json() as Envelope<unknown>).error?.code, 'CONFLICT');
  });

  it('forbids viewers and operators from creating patches', async () => {
    for (const token of [viewerToken, operatorToken]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/patches',
        headers: auth(token),
        payload: { kbNumber: `KB0${String(runId).slice(-7)}`, title: 'Nope' },
      });
      assert.equal(res.statusCode, 403);
    }
  });

  it('lists the catalog with a fleet summary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/patches',
      headers: auth(adminToken),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as Envelope<PatchListData>;
    assert.ok(body.data);
    assert.ok(body.data.total >= 1);
    assert.ok(body.data.items.some((item) => item.kbNumber === KB_D));
    assert.ok(body.data.summary.critical >= 0);
    assert.equal(typeof body.data.summary.upToDatePercent, 'number');
  });

  it('filters the catalog by search and severity', async () => {
    const bySearch = await app.inject({
      method: 'GET',
      url: `/api/patches?search=${KB_D}`,
      headers: auth(adminToken),
    });
    const searchBody = bySearch.json() as Envelope<PatchListData>;
    assert.equal(searchBody.data?.items.length, 1);
    assert.equal(searchBody.data?.items[0]?.kbNumber, KB_D);

    const bySeverity = await app.inject({
      method: 'GET',
      url: '/api/patches?severity=CRITICAL',
      headers: auth(adminToken),
    });
    const severityBody = bySeverity.json() as Envelope<PatchListData>;
    assert.ok(severityBody.data);
    assert.ok(severityBody.data.items.every((item) => item.severity === 'CRITICAL'));
  });

  it('approves a patch through PATCH and records an audit entry', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/patches',
      headers: auth(adminToken),
      payload: { kbNumber: KB_E, title: 'Approval target', severity: 'CRITICAL' },
    });
    assert.equal(created.statusCode, 201);
    const patchId = (created.json() as Envelope<{ id: string }>).data!.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patches/${patchId}`,
      headers: auth(adminToken),
      payload: { status: 'APPROVED' },
    });
    const body = res.json() as Envelope<{ status: string }>;
    assert.equal(res.statusCode, 200);
    assert.equal(body.data?.status, 'APPROVED');

    const audits = await app.prisma.auditLog.findMany({
      where: { action: 'PATCH_UPDATED', resourceId: patchId },
    });
    assert.equal(audits.length, 1);

    const empty = await app.inject({
      method: 'PATCH',
      url: `/api/patches/${patchId}`,
      headers: auth(adminToken),
      payload: {},
    });
    assert.equal(empty.statusCode, 400);
  });

  it('returns 404 for an unknown patch id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/patches/11111111-1111-4111-8111-111111111111',
      headers: auth(adminToken),
    });
    assert.equal(res.statusCode, 404);
  });

  // ── Agent ingestion ─────────────────────────────────────────────────────────

  it('ingests installed hotfixes reported by the agent heartbeat', async () => {
    const res = await heartbeat([
      { kbNumber: KB_A, title: 'Test update A', installedAt: '2026-01-05T00:00:00.000Z' },
      { kbNumber: KB_B, title: 'Test update B', installedAt: '2026-01-06T00:00:00.000Z' },
      { kbNumber: 'GARBAGE', title: 'Not a KB' },
    ]);
    assert.equal(res.statusCode, 200);

    const patchA = await app.prisma.patch.findUnique({
      where: { organizationId_kbNumber: { organizationId: demoOrgId, kbNumber: KB_A } },
    });
    assert.ok(patchA, 'KB should be upserted into the catalog');
    assert.equal(patchA?.title, 'Test update A');

    const rows = await app.prisma.devicePatch.findMany({ where: { deviceId } });
    const installed = rows.filter((row) => row.status === 'INSTALLED');
    assert.equal(installed.length, 2, 'non-KB entries are ignored');

    const garbage = await app.prisma.patch.findFirst({ where: { kbNumber: 'GARBAGE' } });
    assert.equal(garbage, null);
  });

  it('exposes per-device patch state and coverage', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/patches/device/${deviceId}`,
      headers: auth(adminToken),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as Envelope<DevicePatchData>;
    assert.ok(body.data);
    assert.equal(body.data.summary.installed, 2);
    assert.ok(body.data.items.some((item) => item.kbNumber === KB_A && item.deviceStatus === 'INSTALLED'));
    assert.ok(body.data.items.some((item) => item.kbNumber === KB_C && item.deviceStatus === 'MISSING'));
  });

  it('returns per-device coverage for a single patch', async () => {
    const patch = await app.prisma.patch.findUniqueOrThrow({
      where: { organizationId_kbNumber: { organizationId: demoOrgId, kbNumber: KB_C } },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/patches/${patch.id}`,
      headers: auth(adminToken),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as Envelope<PatchDetailData>;
    assert.ok(body.data);
    assert.equal(body.data.id, patch.id);
    const deviceRow = body.data.devices.find((row) => row.id === deviceId);
    assert.ok(deviceRow);
    assert.equal(deviceRow?.patchStatus, 'MISSING');
    assert.equal(deviceRow?.command, null);
  });

  it('marks a previously reported patch as missing once it disappears', async () => {
    const res = await heartbeat([{ kbNumber: KB_A, title: 'Test update A' }]);
    assert.equal(res.statusCode, 200);

    const rowB = await app.prisma.devicePatch.findFirst({
      where: { deviceId, patch: { kbNumber: KB_B } },
    });
    assert.equal(rowB?.status, 'MISSING');
    assert.equal(rowB?.installedAt, null);

    const rowA = await app.prisma.devicePatch.findFirst({
      where: { deviceId, patch: { kbNumber: KB_A } },
    });
    assert.equal(rowA?.status, 'INSTALLED');
  });

  // ── Deployment ──────────────────────────────────────────────────────────────

  it('requires confirmed: true before queueing a deployment', async () => {
    const patch = await app.prisma.patch.findUniqueOrThrow({
      where: { organizationId_kbNumber: { organizationId: demoOrgId, kbNumber: KB_C } },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/patches/${patch.id}/deploy`,
      headers: auth(adminToken),
      payload: { deviceIds: [deviceId] },
    });
    assert.equal(res.statusCode, 400);
    assert.match((res.json() as Envelope<unknown>).error?.message ?? '', /confirmed/);
  });

  it('rejects device ids outside the patch organization', async () => {
    const patch = await app.prisma.patch.findUniqueOrThrow({
      where: { organizationId_kbNumber: { organizationId: demoOrgId, kbNumber: KB_C } },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/patches/${patch.id}/deploy`,
      headers: auth(adminToken),
      payload: { deviceIds: ['11111111-1111-4111-8111-111111111111'], confirmed: true },
    });
    assert.equal(res.statusCode, 400);
    assert.match((res.json() as Envelope<unknown>).error?.message ?? '', /not found/i);
  });

  it('forbids viewers from deploying patches', async () => {
    const patch = await app.prisma.patch.findUniqueOrThrow({
      where: { organizationId_kbNumber: { organizationId: demoOrgId, kbNumber: KB_C } },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/patches/${patch.id}/deploy`,
      headers: auth(viewerToken),
      payload: { deviceIds: [deviceId], confirmed: true },
    });
    assert.equal(res.statusCode, 403);
  });

  it('queues INSTALL_PATCH commands and marks the patch deployed', async () => {
    const patch = await app.prisma.patch.findUniqueOrThrow({
      where: { organizationId_kbNumber: { organizationId: demoOrgId, kbNumber: KB_C } },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/patches/${patch.id}/deploy`,
      headers: auth(adminToken),
      payload: { deviceIds: [deviceId], confirmed: true },
    });
    const body = res.json() as Envelope<DeployData>;
    assert.equal(res.statusCode, 200);
    assert.equal(body.data?.queued, 1);
    assert.equal(body.data?.skippedInstalled, 0);
    assert.equal(body.data?.patch.status, 'DEPLOYED');
    assert.deepEqual(body.data?.deviceIds, [deviceId]);

    const command = await app.prisma.command.findFirstOrThrow({
      where: { deviceId, patchId: patch.id },
    });
    assert.equal(command.type, 'INSTALL_PATCH');
    assert.equal(command.status, 'QUEUED');
    assert.equal(command.organizationId, demoOrgId);

    const audits = await app.prisma.auditLog.findMany({
      where: { action: 'PATCH_DEPLOYED', resourceId: patch.id },
    });
    assert.equal(audits.length, 1);
  });

  it('skips devices that already have an install in flight', async () => {
    const patch = await app.prisma.patch.findUniqueOrThrow({
      where: { organizationId_kbNumber: { organizationId: demoOrgId, kbNumber: KB_C } },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/patches/${patch.id}/deploy`,
      headers: auth(adminToken),
      payload: { deviceIds: [deviceId], confirmed: true },
    });
    const body = res.json() as Envelope<DeployData>;
    assert.equal(res.statusCode, 200);
    assert.equal(body.data?.queued, 0);
    assert.equal(body.data?.skippedInFlight, 1);

    const count = await app.prisma.command.count({ where: { deviceId, patchId: patch.id } });
    assert.equal(count, 1, 'no duplicate command is queued');
  });

  it('delivers the queued command to the agent with its KB parameters', async () => {
    const res = await heartbeat();
    assert.equal(res.statusCode, 200);
    const body = res.json() as Envelope<{
      pendingCommands: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
    }>;
    const pending = body.data?.pendingCommands ?? [];
    assert.equal(pending.length, 1, 'the queued patch command is handed to the agent');
    assert.equal(pending[0]?.type, 'INSTALL_PATCH');
    assert.equal(pending[0]?.params?.kbNumber, KB_C);
    assert.equal(typeof pending[0]?.params?.title, 'string');
  });

  it('lists queued patch commands through the operator command API', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/commands?deviceId=${deviceId}&type=INSTALL_PATCH`,
      headers: auth(adminToken),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as Envelope<{ items: Array<{ type: string; status: string }> }>;
    assert.ok(body.data);
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0]?.type, 'INSTALL_PATCH');
    assert.equal(body.data.items[0]?.status, 'QUEUED');
  });

  it('skips devices that already have the patch installed', async () => {
    const patch = await app.prisma.patch.findUniqueOrThrow({
      where: { organizationId_kbNumber: { organizationId: demoOrgId, kbNumber: KB_A } },
    });

    // Finish the outstanding install so the device counts as up to date.
    await app.prisma.command.updateMany({
      where: { deviceId, patchId: patch.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/patches/${patch.id}/deploy`,
      headers: auth(adminToken),
      payload: { deviceIds: [deviceId], confirmed: true },
    });
    const body = res.json() as Envelope<DeployData>;
    assert.equal(res.statusCode, 200);
    assert.equal(body.data?.queued, 0);
    assert.equal(body.data?.skippedInstalled, 1);
  });

  // ── Tenant isolation ────────────────────────────────────────────────────────

  it('hides patches that belong to another organization', async () => {
    // The seed admin is a SUPER_ADMIN (cross-tenant), so a tenant-scoped
    // reader is used to prove org isolation.
    const res = await app.inject({
      method: 'GET',
      url: `/api/patches/${foreignPatchId}`,
      headers: auth(viewerToken),
    });
    assert.equal(res.statusCode, 404);

    const list = await app.inject({
      method: 'GET',
      url: '/api/patches?search=Foreign',
      headers: auth(viewerToken),
    });
    const body = list.json() as Envelope<PatchListData>;
    assert.equal(body.data?.items.length, 0);
  });
});
