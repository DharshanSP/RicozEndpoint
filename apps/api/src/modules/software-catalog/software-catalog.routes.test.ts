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

interface CatalogData {
  items: Array<{ id: string; name: string; publisher: string; installerUrl: string; deviceCount: number }>;
  total: number;
}

interface DeployData {
  deploymentId: string | null;
  status: string;
  action: string;
  deploymentIds: string[];
  queued: number;
  skippedInFlight: number;
  deviceIds: string[];
}

interface DeploymentListData {
  items: Array<{
    id: string;
    status: string;
    action: string;
    errorMessage: string | null;
    application: { name: string; installerUrl: string };
    device: { id: string };
    requester: { name: string } | null;
  }>;
  total: number;
  summary: { total: number; pending: number; completed: number; failed: number };
}

describe('Software deployment API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let scopedAdminToken: string;
  let viewerToken: string;
  let operatorToken: string;
  let foreignToken: string;
  let demoOrgId: string;
  let deviceId: string;
  let agentToken: string;
  let emptyGroupId: string;
  let foreignDeviceId: string;

  const runId = Date.now();
  const APP_NAME = `Ricoz Test App ${runId}`;
  const INSTALLER_URL = `https://packages.ricoz.local/${runId}/setup.msi`;
  const MISSING_URL_APP = `Ricoz No Package ${runId}`;
  const ourUserEmails = [
    `software-admin-${runId}@ricoz.local`,
    `software-viewer-${runId}@ricoz.local`,
    `software-operator-${runId}@ricoz.local`,
    `software-foreign-${runId}@ricoz.local`,
  ];

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  const deploy = (token: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/api/software/deploy',
      headers: auth(token),
      payload,
    });

  const heartbeat = (software?: Array<Record<string, unknown>>) =>
    app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: { 'x-agent-token': agentToken },
      payload: {
        deviceId,
        agentVersion: '0.1.0',
        timestamp: new Date().toISOString(),
        status: 'ONLINE',
        ...(software ? { software: { items: software } } : {}),
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

    // Drop leftovers from a previous run.
    await app.prisma.application
      .deleteMany({ where: { organizationId: demoOrgId, name: { in: [APP_NAME, MISSING_URL_APP] } } })
      .catch(() => undefined);

    // Tenant-scoped IT admin: proves org scoping (the seed admin is a
    // cross-tenant SUPER_ADMIN).
    const scopedAdmin = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: ourUserEmails[0]!,
        name: 'Software Scoped Admin',
        passwordHash: await hashPassword('admin123'),
        role: 'IT_ADMIN',
      },
    });
    scopedAdminToken = await login(scopedAdmin.email, 'admin123');

    const viewerUser = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: ourUserEmails[1]!,
        name: 'Software Viewer',
        passwordHash: await hashPassword('viewer123'),
        role: 'VIEWER',
      },
    });
    viewerToken = await login(viewerUser.email, 'viewer123');

    const operatorUser = await app.prisma.user.create({
      data: {
        organizationId: demoOrgId,
        email: ourUserEmails[2]!,
        name: 'Software Operator',
        passwordHash: await hashPassword('operator123'),
        role: 'OPERATOR',
      },
    });
    operatorToken = await login(operatorUser.email, 'operator123');

    const tokenRes = await app.inject({
      method: 'POST',
      url: '/api/enrollment-tokens',
      headers: auth(adminToken),
      payload: { label: `software-test-${runId}`, maxUses: 1 },
    });
    const token = (tokenRes.json() as Envelope<{ token: string }>).data!.token;

    const enrollRes = await app.inject({
      method: 'POST',
      url: '/api/enroll',
      payload: {
        enrollmentToken: token,
        hostname: 'SOFTWARE-TEST-HOST',
        serialNumber: `SN-SOFTWARE-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        agentVersion: '0.1.0',
      },
    });
    const enrollBody = enrollRes.json() as Envelope<{ deviceId: string; agentToken: string }>;
    assert.equal(enrollRes.statusCode, 201);
    deviceId = enrollBody.data!.deviceId;
    agentToken = enrollBody.data!.agentToken;

    // An empty group proves the target-group validation path.
    const group = await app.prisma.deviceGroup.create({
      data: { organizationId: demoOrgId, name: `Software Empty Group ${runId}` },
    });
    emptyGroupId = group.id;

    // A second tenant used for isolation checks.
    const foreignOrg = await app.prisma.organization.create({
      data: { name: `Software Foreign Org ${runId}` },
    });
    const foreignUser = await app.prisma.user.create({
      data: {
        organizationId: foreignOrg.id,
        email: ourUserEmails[3]!,
        name: 'Foreign Reader',
        passwordHash: await hashPassword('viewer123'),
        role: 'IT_ADMIN',
      },
    });
    foreignToken = await login(foreignUser.email, 'viewer123');

    // Created directly (not enrolled) so this file only owns one agent session
    // and cannot race other suites' enrollment queries.
    const foreignDevice = await app.prisma.device.create({
      data: {
        organizationId: foreignOrg.id,
        deviceName: 'Foreign Endpoint',
        hostname: 'FOREIGN-HOST',
        serialNumber: `SN-SOFTWARE-FX-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        architecture: 'x64',
      },
    });
    foreignDeviceId = foreignDevice.id;
  });

  after(async () => {
    if (deviceId) {
      await app.prisma.command.deleteMany({ where: { deviceId } }).catch(() => undefined);
      await app.prisma.deployment.deleteMany({ where: { deviceId } }).catch(() => undefined);
      await app.prisma.device.delete({ where: { id: deviceId } }).catch(() => undefined);
    }
    if (foreignDeviceId) {
      await app.prisma.command.deleteMany({ where: { deviceId: foreignDeviceId } }).catch(() => undefined);
      await app.prisma.deployment.deleteMany({ where: { deviceId: foreignDeviceId } }).catch(() => undefined);
      await app.prisma.device.delete({ where: { id: foreignDeviceId } }).catch(() => undefined);
    }
    if (emptyGroupId) {
      await app.prisma.deviceGroup.delete({ where: { id: emptyGroupId } }).catch(() => undefined);
    }
    if (demoOrgId) {
      await app.prisma.application
        .deleteMany({ where: { organizationId: demoOrgId, name: { in: [APP_NAME, MISSING_URL_APP] } } })
        .catch(() => undefined);
    }
    const foreignOrg = await app.prisma.organization
      .findFirst({ where: { name: `Software Foreign Org ${runId}` }, select: { id: true } })
      .catch(() => null);
    await app.prisma.user.deleteMany({ where: { email: { in: ourUserEmails } } }).catch(() => undefined);
    if (foreignOrg) {
      await app.prisma.device.deleteMany({ where: { organizationId: foreignOrg.id } }).catch(() => undefined);
      await app.prisma.command.deleteMany({ where: { organizationId: foreignOrg.id } }).catch(() => undefined);
      await app.prisma.deployment
        .deleteMany({ where: { organizationId: foreignOrg.id } })
        .catch(() => undefined);
      await app.prisma.application
        .deleteMany({ where: { organizationId: foreignOrg.id } })
        .catch(() => undefined);
      await app.prisma.enrollmentToken
        .deleteMany({ where: { organizationId: foreignOrg.id } })
        .catch(() => undefined);
      await app.prisma.auditLog
        .deleteMany({ where: { organizationId: foreignOrg.id } })
        .catch(() => undefined);
      await app.prisma.organization.delete({ where: { id: foreignOrg.id } }).catch(() => undefined);
    }
    await app.close();
  });

  // ── Catalog ────────────────────────────────────────────────────────────────

  it('exposes the aggregated catalog to a viewer', async () => {
    await heartbeat([
      {
        name: APP_NAME,
        version: '2.1.0',
        publisher: 'Ricoz QA',
        installDate: null,
        architecture: '64-bit',
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/software?search=${encodeURIComponent(APP_NAME)}`,
      headers: auth(viewerToken),
    });
    const body = res.json() as Envelope<CatalogData>;
    assert.equal(res.statusCode, 200);
    const item = body.data?.items.find((row) => row.name === APP_NAME);
    assert.ok(item, 'the reported application appears in the catalog');
    assert.equal(typeof item.id, 'string');
    assert.equal(item.id.length > 0, true);
    assert.equal(item.installerUrl, '');
  });

  // ── Authorization ──────────────────────────────────────────────────────────

  it('refuses deployment from a viewer', async () => {
    const res = await deploy(viewerToken, {
      name: APP_NAME,
      version: '2.1.0',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'INSTALL',
      installerUrl: INSTALLER_URL,
    });
    assert.equal(res.statusCode, 403);
  });

  it('refuses deployment from an operator', async () => {
    const res = await deploy(operatorToken, {
      name: APP_NAME,
      version: '2.1.0',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'INSTALL',
      installerUrl: INSTALLER_URL,
    });
    assert.equal(res.statusCode, 403);
  });

  // ── Payload validation ─────────────────────────────────────────────────────

  it('requires confirmed: true', async () => {
    const res = await deploy(adminToken, {
      name: APP_NAME,
      version: '2.1.0',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'INSTALL',
      installerUrl: INSTALLER_URL,
      confirmed: false,
    });
    assert.equal(res.statusCode, 400);
    assert.match((res.json() as Envelope<unknown>).error?.message ?? '', /confirmed/i);
  });

  it('requires an installer URL when nothing is stored for the application', async () => {
    const res = await deploy(adminToken, {
      name: MISSING_URL_APP,
      version: '1.0.0',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'INSTALL',
      confirmed: true,
    });
    assert.equal(res.statusCode, 400);
    assert.match((res.json() as Envelope<unknown>).error?.message ?? '', /installerUrl/);
  });

  it('rejects a non http(s) installer URL', async () => {
    const res = await deploy(adminToken, {
      name: APP_NAME,
      version: '2.1.0',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'INSTALL',
      installerUrl: 'file:///C:/temp/setup.msi',
      confirmed: true,
    });
    assert.equal(res.statusCode, 400);
  });

  it('returns 404 for a device outside the organization', async () => {
    const res = await deploy(scopedAdminToken, {
      name: APP_NAME,
      version: '2.1.0',
      targetType: 'DEVICE',
      targetId: foreignDeviceId,
      action: 'INSTALL',
      installerUrl: INSTALLER_URL,
      confirmed: true,
    });
    assert.equal(res.statusCode, 404);
  });

  it('returns 400 for a device group with no members', async () => {
    const res = await deploy(adminToken, {
      name: APP_NAME,
      version: '2.1.0',
      targetType: 'GROUP',
      targetId: emptyGroupId,
      action: 'INSTALL',
      installerUrl: INSTALLER_URL,
      confirmed: true,
    });
    assert.equal(res.statusCode, 400);
    assert.match((res.json() as Envelope<unknown>).error?.message ?? '', /no devices/i);
  });

  // ── Queueing ───────────────────────────────────────────────────────────────

  it('queues an install, creates the application and records a deployment', async () => {
    const res = await deploy(adminToken, {
      name: APP_NAME,
      version: '2.1.0',
      publisher: 'Ricoz QA',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'INSTALL',
      installerUrl: INSTALLER_URL,
      silentArgs: '/quiet',
      confirmed: true,
    });
    const body = res.json() as Envelope<DeployData>;
    assert.equal(res.statusCode, 201, JSON.stringify(body.error ?? {}));
    assert.equal(body.data?.queued, 1);
    assert.equal(body.data?.skippedInFlight, 0);
    assert.equal(body.data?.action, 'INSTALL');
    assert.ok(body.data?.deploymentId);
    assert.equal(body.data?.deviceIds[0], deviceId);

    const application = await app.prisma.application.findFirst({
      where: { organizationId: demoOrgId, name: APP_NAME },
    });
    assert.ok(application, 'a managed application row is created');
    assert.equal(application.installerUrl, INSTALLER_URL);

    const deployment = await app.prisma.deployment.findFirst({
      where: { id: body.data!.deploymentId! },
    });
    assert.equal(deployment?.status, 'PENDING');
    assert.equal(deployment?.action, 'INSTALL');
    assert.equal(deployment?.deviceId, deviceId);
    assert.equal(deployment?.organizationId, demoOrgId);

    const command = await app.prisma.command.findFirst({
      where: { deviceId, deploymentId: body.data!.deploymentId!, type: 'INSTALL_APPLICATION' },
    });
    assert.ok(command, 'a command is linked to the deployment');
    assert.equal(command.status, 'QUEUED');
    const params = JSON.parse(command.result ?? '{}') as Record<string, unknown>;
    assert.equal(params.installerUrl, INSTALLER_URL);
    assert.equal(params.name, APP_NAME);
    assert.equal(params.silentArgs, '/quiet');
  });

  it('skips a device that already has this install in flight', async () => {
    const res = await deploy(adminToken, {
      name: APP_NAME,
      version: '2.1.0',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'INSTALL',
      installerUrl: INSTALLER_URL,
      confirmed: true,
    });
    const body = res.json() as Envelope<DeployData>;
    assert.equal(res.statusCode, 201);
    assert.equal(body.data?.queued, 0);
    assert.equal(body.data?.skippedInFlight, 1);

    const count = await app.prisma.command.count({
      where: { deviceId, type: 'INSTALL_APPLICATION' },
    });
    assert.equal(count, 1, 'no duplicate install command is queued');
  });

  it('delivers the queued command with its installer parameters', async () => {
    const res = await heartbeat();
    assert.equal(res.statusCode, 200);
    const body = res.json() as Envelope<{
      pendingCommands: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
    }>;
    const pending = body.data?.pendingCommands ?? [];
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.type, 'INSTALL_APPLICATION');
    assert.equal(pending[0]?.params?.installerUrl, INSTALLER_URL);
    assert.equal(pending[0]?.params?.name, APP_NAME);
    assert.equal(typeof pending[0]?.params?.deploymentId, 'string');
  });

  it('marks the deployment completed when the agent reports success', async () => {
    const command = await app.prisma.command.findFirstOrThrow({
      where: { deviceId, type: 'INSTALL_APPLICATION', status: 'QUEUED' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/agent/commands/${command.id}/result`,
      headers: { 'x-agent-token': agentToken },
      payload: { status: 'COMPLETED', result: `${APP_NAME} installed successfully` },
    });
    assert.equal(res.statusCode, 200);

    const deployment = await app.prisma.deployment.findFirstOrThrow({
      where: { id: command.deploymentId! },
    });
    assert.equal(deployment.status, 'COMPLETED');
    assert.ok(deployment.completedAt);
  });

  it('marks the deployment failed when the agent reports an error', async () => {
    const res = await deploy(adminToken, {
      name: MISSING_URL_APP,
      version: '9.9.9',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'UNINSTALL',
      confirmed: true,
    });
    const body = res.json() as Envelope<DeployData>;
    assert.equal(res.statusCode, 201);
    assert.equal(body.data?.queued, 1);
    assert.equal(body.data?.action, 'UNINSTALL');

    const command = await app.prisma.command.findFirstOrThrow({
      where: { deviceId, type: 'UNINSTALL_APPLICATION', status: 'QUEUED' },
    });
    const params = JSON.parse(command.result ?? '{}') as Record<string, unknown>;
    assert.equal(params.name, MISSING_URL_APP);
    assert.equal(params.installerUrl, undefined);

    const failed = await app.inject({
      method: 'POST',
      url: `/api/agent/commands/${command.id}/result`,
      headers: { 'x-agent-token': agentToken },
      payload: { status: 'FAILED', errorMessage: `${MISSING_URL_APP} is not installed on this device` },
    });
    assert.equal(failed.statusCode, 200);

    const deployment = await app.prisma.deployment.findFirstOrThrow({
      where: { id: command.deploymentId! },
    });
    assert.equal(deployment.status, 'FAILED');
    assert.match(deployment.errorMessage ?? '', /not installed/);
  });

  it('reuses the stored installer URL when none is supplied', async () => {
    const res = await deploy(adminToken, {
      name: APP_NAME,
      version: '2.1.0',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'INSTALL',
      confirmed: true,
    });
    const body = res.json() as Envelope<DeployData>;
    assert.equal(res.statusCode, 201, JSON.stringify(body.error ?? {}));
    assert.equal(body.data?.queued, 1);

    const command = await app.prisma.command.findFirstOrThrow({
      where: { deviceId, deploymentId: body.data!.deploymentId! },
    });
    const params = JSON.parse(command.result ?? '{}') as Record<string, unknown>;
    assert.equal(params.installerUrl, INSTALLER_URL);
  });

  // ── Deployment history ─────────────────────────────────────────────────────

  it('lists deployments for the device with application and requester context', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/software/deployments?deviceId=${deviceId}&limit=50`,
      headers: auth(viewerToken),
    });
    const body = res.json() as Envelope<DeploymentListData>;
    assert.equal(res.statusCode, 200);
    assert.ok(body.data);
    assert.equal(body.data.total, 3, 'install, duplicate-queue attempt and uninstall are recorded');
    assert.equal(body.data.summary.total, 3);
    assert.equal(body.data.summary.completed, 1);
    assert.equal(body.data.summary.failed, 1);
    assert.equal(body.data.summary.pending, 1);

    const install = body.data.items.find((row) => row.application.name === APP_NAME);
    assert.ok(install);
    assert.equal(install.device.id, deviceId);
    assert.equal(install.requester?.name, 'System Admin');
    assert.equal(install.application.installerUrl, INSTALLER_URL);

    const statuses = new Set(body.data.items.map((row) => row.status));
    assert.deepEqual([...statuses].sort(), ['COMPLETED', 'FAILED', 'PENDING']);
  });

  it('surfaces the managed installer URL in the catalog after the first deploy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/software?search=${encodeURIComponent(APP_NAME)}`,
      headers: auth(viewerToken),
    });
    const body = res.json() as Envelope<CatalogData>;
    const item = body.data?.items.find((row) => row.name === APP_NAME);
    assert.ok(item);
    assert.equal(item.installerUrl, INSTALLER_URL);
  });

  it('supports filtering deployments by status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/software/deployments?deviceId=${deviceId}&status=FAILED`,
      headers: auth(viewerToken),
    });
    const body = res.json() as Envelope<DeploymentListData>;
    assert.equal(res.statusCode, 200);
    assert.equal(body.data?.total, 1);
    assert.equal(body.data?.items[0]?.action, 'UNINSTALL');
  });

  // ── Generic command API ────────────────────────────────────────────────────

  it('validates installer parameters on the generic command endpoint', async () => {
    const missing = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: auth(adminToken),
      payload: { deviceId, type: 'INSTALL_APPLICATION', confirmed: true },
    });
    assert.equal(missing.statusCode, 400);
    assert.match((missing.json() as Envelope<unknown>).error?.message ?? '', /installerUrl/);

    const missingName = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: auth(adminToken),
      payload: { deviceId, type: 'UNINSTALL_APPLICATION', confirmed: true },
    });
    assert.equal(missingName.statusCode, 400);
    assert.match((missingName.json() as Envelope<unknown>).error?.message ?? '', /params\.name/);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: auth(adminToken),
      payload: {
        deviceId,
        type: 'INSTALL_APPLICATION',
        confirmed: true,
        params: { installerUrl: INSTALLER_URL, name: APP_NAME },
      },
    });
    assert.equal(ok.statusCode, 201);
    const created = (ok.json() as Envelope<{ id: string }>).data;
    await app.prisma.command.delete({ where: { id: created!.id } }).catch(() => undefined);
  });

  // ── Tenant isolation ───────────────────────────────────────────────────────

  it('hides deployments from another organization', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/software/deployments?deviceId=${deviceId}`,
      headers: auth(foreignToken),
    });
    const body = res.json() as Envelope<DeploymentListData>;
    assert.equal(res.statusCode, 200);
    assert.equal(body.data?.total, 0);

    const denied = await deploy(foreignToken, {
      name: APP_NAME,
      version: '2.1.0',
      targetType: 'DEVICE',
      targetId: deviceId,
      action: 'INSTALL',
      installerUrl: INSTALLER_URL,
      confirmed: true,
    });
    assert.equal(denied.statusCode, 404);
  });
});
