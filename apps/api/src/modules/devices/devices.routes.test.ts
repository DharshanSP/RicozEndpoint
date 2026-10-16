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

type TenantSeed = {
  organizationId: string;
  userId: string;
  deviceId: string;
  token: string;
};

describe('Device Management API', () => {
  let app: FastifyInstance;
  let tenantSeed: TenantSeed;
  let demoOrgId: string;
  let demoDeviceId: string;
  let fixtureDeviceId: string;
  const runId = `${Date.now()}-${process.pid}`;

  before(async () => {
    app = await buildApp();

    // Resolve seed organization + device
    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    demoOrgId = org.id;

    // Create a self-contained fixture device instead of relying on seeded demo data.
    const fixtureSerial = `SN-FIXTURE-${runId}`;
    const fixtureHostname = `FIXTURE-HOST-${runId}`;
    const fixture = await app.prisma.device.create({
      data: {
        organizationId: demoOrgId,
        deviceName: fixtureHostname,
        hostname: fixtureHostname,
        serialNumber: fixtureSerial,
        manufacturer: 'Fixture',
        model: 'VM-FIXTURE',
        os: 'Windows',
        osVersion: 'Windows 11 Pro 23H2',
        architecture: 'x64',
        ipAddress: '10.9.8.7',
        agentVersion: '0.1.0',
        status: 'ONLINE',
        lastSeenAt: new Date(),
      },
    });
    demoDeviceId = fixture.id;
    fixtureDeviceId = fixture.id;

    await app.prisma.deviceHardware.create({
      data: {
        deviceId: fixture.id,
        cpu: 'Intel Core i7-12700',
        cpuCores: 12,
        ramBytes: BigInt(16) * BigInt(1024) * BigInt(1024) * BigInt(1024),
        storageBytes: BigInt(512) * BigInt(1024) * BigInt(1024) * BigInt(1024),
        manufacturer: 'Fixture',
        model: 'VM-FIXTURE',
        serialNumber: fixtureSerial,
        biosVersion: '1.5.0',
      },
    });

    await app.prisma.deviceSoftware.createMany({
      data: [
        {
          deviceId: fixture.id,
          name: `Fixture Office ${runId}`,
          version: '1.0.0',
          publisher: 'Fixture Publisher',
          installDate: new Date('2024-01-15'),
          architecture: 'x64',
        },
        {
          deviceId: fixture.id,
          name: `Fixture Browser ${runId}`,
          version: '2.0.0',
          publisher: 'Fixture Publisher',
          installDate: new Date('2024-02-01'),
          architecture: 'x64',
        },
      ],
    });

    // Create an isolated tenant: second organization with a device + user
    const tenantOrg = await app.prisma.organization.create({
      data: { name: `Isolation Test Org ${Date.now()}` },
    });

    const tenantUser = await app.prisma.user.create({
      data: {
        organizationId: tenantOrg.id,
        email: `isolation-${Date.now()}@ricoz.local`,
        name: 'Isolation Operator',
        passwordHash: await hashPassword('isolation123'),
        role: 'OPERATOR',
      },
    });

    const tenantDevice = await app.prisma.device.create({
      data: {
        organizationId: tenantOrg.id,
        deviceName: 'ISOLATION-DEV-001',
        hostname: 'ISOLATION-DEV-001',
        serialNumber: 'SN-ISOLATION-001',
        manufacturer: 'Test',
        model: 'VM-1',
        os: 'Windows',
        osVersion: 'Windows 10 Pro 22H2',
        architecture: 'x64',
        ipAddress: '10.0.0.5',
        agentVersion: '0.1.0',
        status: 'ONLINE',
        lastSeenAt: new Date(),
      },
    });

    const tenantLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: tenantUser.email, password: 'isolation123' },
    });
    const tenantBody = tenantLogin.json() as LoginResponse;
    assert.ok(tenantLogin.statusCode === 200 && tenantBody.data?.token, 'Tenant user should log in');

    tenantSeed = {
      organizationId: tenantOrg.id,
      userId: tenantUser.id,
      deviceId: tenantDevice.id,
      token: tenantBody.data!.token as string,
    };
  });

  after(async () => {
    // Clean up isolated tenant (audit logs reference the org, so remove them first)
    await app.prisma.auditLog.deleteMany({ where: { organizationId: tenantSeed.organizationId } });
    await app.prisma.device.delete({ where: { id: fixtureDeviceId } }).catch(() => undefined);
    await app.prisma.user.delete({ where: { id: tenantSeed.userId } });
    await app.prisma.device.delete({ where: { id: tenantSeed.deviceId } });
    await app.prisma.organization.delete({ where: { id: tenantSeed.organizationId } });
    await app.close();
  });

  async function loginAdmin(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    const body = res.json() as LoginResponse;
    assert.ok(res.statusCode === 200 && body.data?.token, 'Admin should log in');
    return body.data!.token as string;
  }

  function authHeaders(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  it('rejects unauthenticated requests to list devices', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/devices' });
    assert.equal(res.statusCode, 401);
  });

  it('rejects requests with an invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('validates invalid query parameters with 400', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices?limit=abc',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, 'VALIDATION_ERROR');
  });

  it('lists devices with pagination metadata for SUPER_ADMIN', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices?page=1&limit=2',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      success: boolean;
      data: Record<string, unknown>[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 2);
    assert.ok(body.pagination.total >= 2, 'SUPER_ADMIN should see devices across all organizations');
    assert.equal(body.pagination.totalPages, Math.ceil(body.pagination.total / 2));

    const first = body.data[0] as Record<string, unknown>;
    assert.ok(typeof first.id === 'string');
    assert.ok(typeof first.deviceName === 'string');
    assert.ok(typeof first.hostname === 'string');
    assert.ok(['ONLINE', 'OFFLINE', 'UNKNOWN', 'PENDING', 'NON_COMPLIANT'].includes(first.status as string));
    assert.ok(typeof first.os === 'string');
    assert.ok(typeof first.osVersion === 'string');
    assert.ok(typeof first.ipAddress === 'string');
    assert.ok(typeof first.agentVersion === 'string');
    assert.ok(typeof first.complianceStatus === 'string');
  });

  it('filters devices by status', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices?status=ONLINE&limit=100',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: { status: string }[] };
    assert.ok(body.data.length >= 1);
    assert.ok(body.data.every((device) => device.status === 'ONLINE'));
  });

  it('filters devices by OS', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices?os=Windows&limit=100',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: { os: string }[] };
    assert.ok(body.data.length >= 1);
    assert.ok(body.data.every((device) => device.os.toLowerCase().includes('windows')));
  });

  it('searches devices by hostname and serial number', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices?search=SN-FIXTURE-${runId}&limit=100`,
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: { serialNumber: string; hostname: string }[] };
    assert.ok(body.data.length >= 1);
    assert.ok(body.data.some((device) => device.serialNumber === `SN-FIXTURE-${runId}`));

    const res2 = await app.inject({
      method: 'GET',
      url: `/api/devices?search=FIXTURE-HOST-${runId}&limit=100`,
      headers: authHeaders(token),
    });
    const body2 = res2.json() as { data: { hostname: string }[] };
    assert.ok(body2.data.length >= 1);
    assert.ok(body2.data.every((device) => device.hostname.toLowerCase().includes(`fixture-host-${runId}`.toLowerCase())));
  });

  it('sorts devices by the requested field', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices?sortBy=deviceName&sortOrder=asc&limit=100',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: { deviceName: string }[] };
    const names = body.data.map((device) => device.deviceName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sorted);
  });

  it('returns 404 for a non-existent device', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices/00000000-0000-0000-0000-000000000000',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 404);
  });

  it('returns full device detail with all sections', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${demoDeviceId}`,
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { success: boolean; data: Record<string, unknown> };
    assert.equal(body.success, true);
    const data = body.data as Record<string, unknown>;
    assert.ok(data.overview, 'overview section present');
    assert.ok(data.hardware, 'hardware section present');
    assert.ok(Array.isArray(data.software), 'software section present');
    assert.ok(Array.isArray(data.policies), 'policies section present');
    assert.ok(Array.isArray(data.compliance), 'compliance section present');
    assert.ok(Array.isArray(data.commands), 'commands section present');
    assert.ok(Array.isArray(data.activity), 'activity section present');

    const hardware = data.hardware as Record<string, unknown>;
    assert.equal(hardware.cpuCores, 12);
    assert.equal(typeof hardware.ramBytes, 'string', 'BigInt serialized as string');
    assert.equal(typeof hardware.storageBytes, 'string');
  });

  it('returns hardware inventory for a device', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${demoDeviceId}/hardware`,
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: Record<string, unknown> };
    assert.equal(body.data.cpu, 'Intel Core i7-12700');
    assert.equal(typeof body.data.ramBytes, 'string');
  });

  it('returns software inventory for a device', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${demoDeviceId}/software`,
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: { id: string; name: string; version: string; publisher: string }[] };
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((item) => item.name === `Fixture Office ${runId}`));
    assert.ok(body.data.every((item) => typeof item.name === 'string' && typeof item.version === 'string'));
  });

  it('returns activity stream for a device', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${demoDeviceId}/activity`,
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: { id: string; type: string; timestamp: string; description: string }[] };
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.every((event) => typeof event.id === 'string' && typeof event.timestamp === 'string'));
  });

  it('verifies the current account password before deleting a device', async () => {
    const token = await loginAdmin();
    const target = await app.prisma.device.create({
      data: {
        organizationId: demoOrgId,
        deviceName: `DELETE-FIXTURE-${runId}`,
        hostname: `DELETE-FIXTURE-${runId}`,
        serialNumber: `SN-DELETE-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        status: 'ONLINE',
        architecture: 'x64',
      },
    });

    const wrong = await app.inject({
      method: 'DELETE',
      url: `/api/devices/${target.id}`,
      headers: authHeaders(token),
      payload: { password: 'not-the-admin-password' },
    });
    assert.equal(wrong.statusCode, 403);
    assert.equal(wrong.json().error.message, 'Invalid password');

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/devices/${target.id}`,
      headers: authHeaders(token),
      payload: { password: 'admin123' },
    });
    assert.equal(deleted.statusCode, 200);
    assert.equal(await app.prisma.device.findUnique({ where: { id: target.id } }), null);
  });

  it('scopes device list to the caller organization', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices?limit=100',
      headers: authHeaders(tenantSeed.token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { success: boolean; data: { id: string }[] };
    assert.equal(body.data.length, 1, 'Isolation tenant sees only its own device');
    assert.equal(body.data[0]?.id, tenantSeed.deviceId);
    assert.ok(!body.data.some((device) => device.id === demoDeviceId));
  });

  it('prevents cross-organization device detail access', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${demoDeviceId}`,
      headers: authHeaders(tenantSeed.token),
    });
    assert.equal(res.statusCode, 404);

    const hardware = await app.inject({
      method: 'GET',
      url: `/api/devices/${demoDeviceId}/hardware`,
      headers: authHeaders(tenantSeed.token),
    });
    assert.equal(hardware.statusCode, 404);

    const software = await app.inject({
      method: 'GET',
      url: `/api/devices/${demoDeviceId}/software`,
      headers: authHeaders(tenantSeed.token),
    });
    assert.equal(software.statusCode, 404);

    const activity = await app.inject({
      method: 'GET',
      url: `/api/devices/${demoDeviceId}/activity`,
      headers: authHeaders(tenantSeed.token),
    });
    assert.equal(activity.statusCode, 404);
  });

  it('lets SUPER_ADMIN access any organization device', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${tenantSeed.deviceId}`,
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: { overview: { id: string } } };
    assert.equal(body.data.overview.id, tenantSeed.deviceId);
  });

  it('exposes device endpoints on the OpenAPI docs description', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    assert.equal(res.statusCode, 200);
    const swagger = res.json() as { paths: Record<string, unknown> };
    assert.ok(swagger.paths['/api/devices/']);
    assert.ok(swagger.paths['/api/devices/summary']);
    assert.ok(swagger.paths['/api/devices/{id}']);
    assert.ok(swagger.paths['/api/devices/{id}/hardware']);
    assert.ok(swagger.paths['/api/devices/{id}/software']);
    assert.ok(swagger.paths['/api/devices/{id}/activity']);
  });
});

describe('Device Summary API', () => {
  let app: FastifyInstance;
  let orgId: string;
  let adminToken: string;
  let demoToken: string;
  const runId = `${Date.now()}-${process.pid}`;

  async function login(email: string, password: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    const body = res.json() as LoginResponse;
    assert.ok(res.statusCode === 200 && body.data?.token, `${email} should log in`);
    return body.data!.token as string;
  }

  before(async () => {
    app = await buildApp();
    const org = await app.prisma.organization.create({ data: { name: `Device-Summary-${runId}` } });
    orgId = org.id;

    const admin = await app.prisma.user.create({
      data: {
        organizationId: orgId,
        email: `summary-admin-${runId}@ricoz.local`,
        name: 'Summary Admin',
        passwordHash: await hashPassword('summary123'),
        role: 'ORG_ADMIN',
      },
    });
    const demo = await app.prisma.user.create({
      data: {
        organizationId: orgId,
        email: `summary-demo-${runId}@ricoz.local`,
        name: 'Summary Demo',
        passwordHash: await hashPassword('summary123'),
        role: 'VIEWER',
        isDemoAccount: true,
      },
    });
    adminToken = await login(admin.email, 'summary123');
    demoToken = await login(demo.email, 'summary123');

    await app.prisma.device.createMany({
      data: [
        {
          organizationId: orgId,
          deviceName: `SUMMARY-ONLINE-${runId}`,
          hostname: `SUMMARY-ONLINE-${runId}`,
          serialNumber: `SN-SUMMARY-ONLINE-${runId}`,
          os: 'Windows',
          osVersion: 'Windows 11',
          status: 'ONLINE',
          architecture: 'x64',
        },
        {
          organizationId: orgId,
          deviceName: `SUMMARY-OFFLINE-${runId}`,
          hostname: `SUMMARY-OFFLINE-${runId}`,
          serialNumber: `SN-SUMMARY-OFFLINE-${runId}`,
          os: 'Windows',
          osVersion: 'Windows 11',
          status: 'OFFLINE',
          architecture: 'x64',
        },
        {
          organizationId: orgId,
          deviceName: `SUMMARY-PENDING-${runId}`,
          hostname: `SUMMARY-PENDING-${runId}`,
          serialNumber: `SN-SUMMARY-PENDING-${runId}`,
          os: 'Windows',
          osVersion: 'Windows 11',
          status: 'PENDING',
          architecture: 'x64',
          isDemoSeed: true,
        },
      ],
    });
  });

  after(async () => {
    await app.prisma.auditLog.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await app.prisma.device.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await app.prisma.user.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await app.prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    await app.close();
  });

  it('returns fleet status counts in one lightweight response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices/summary',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), {
      success: true,
      data: { totalDevices: 3, onlineDevices: 1, offlineDevices: 1, pendingDevices: 1 },
    });
  });

  it('scopes demo logins to seeded devices', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices/summary',
      headers: { authorization: `Bearer ${demoToken}` },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), {
      success: true,
      data: { totalDevices: 1, onlineDevices: 0, offlineDevices: 0, pendingDevices: 1 },
    });
  });
});

describe('Device Management API: demo login scope', () => {
  let app: FastifyInstance;
  let demoOrgId: string;
  let enrolledDeviceId: string;
  let seededDeviceIds: string[] = [];
  const scopeRunId = `${Date.now()}-${process.pid}`;

  interface DeviceListBody {
    success: boolean;
    data: { id: string; serialNumber: string; isDemoSeed: boolean }[];
    pagination: { total: number };
  }

  async function login(email: string, password: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    const body = res.json() as LoginResponse;
    assert.ok(res.statusCode === 200 && body.data?.token, `${email} should log in`);
    return body.data!.token as string;
  }

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    demoOrgId = org.id;

    // A really enrolled (non-seed) endpoint in the demo org.
    const serial = `SN-REAL-${Date.now()}`;
    const enrolled = await app.prisma.device.create({
      data: {
        organizationId: demoOrgId,
        deviceName: 'REAL-WKS-001',
        hostname: 'REAL-WKS-001',
        serialNumber: serial,
        manufacturer: 'Test',
        model: 'VM-1',
        os: 'Windows',
        osVersion: 'Windows 11 Pro 23H2',
        architecture: 'x64',
        ipAddress: '10.9.9.9',
        agentVersion: '0.1.0',
        status: 'ONLINE',
        lastSeenAt: new Date(),
      },
    });
    enrolledDeviceId = enrolled.id;

    // Fixture scoped devices for demo-login assertions. Production seed data no
    // longer includes a demo fleet, so these tests bring their own fixtures.
    seededDeviceIds = await Promise.all(
      ['SCOPE-A', 'SCOPE-B'].map(async (suffix) => {
        const scoped = await app.prisma.device.create({
          data: {
            organizationId: demoOrgId,
            deviceName: `SCOPE-${suffix}-${scopeRunId}`,
            hostname: `SCOPE-${suffix}-${scopeRunId}`,
            serialNumber: `SN-SCOPE-${suffix}-${scopeRunId}`,
            manufacturer: 'Test',
            model: 'VM-1',
            os: 'Windows',
            osVersion: 'Windows 11 Pro 23H2',
            architecture: 'x64',
            ipAddress: '10.9.9.8',
            agentVersion: '0.1.0',
            status: 'ONLINE',
            lastSeenAt: new Date(),
            isDemoSeed: true,
          },
        });
        return scoped.id;
      })
    );
  });

  after(async () => {
    await app.prisma.device.deleteMany({ where: { id: { in: seededDeviceIds } } }).catch(() => undefined);
    await app.prisma.device.delete({ where: { id: enrolledDeviceId } }).catch(() => undefined);
    await app.close();
  });

  it('shows only demo-seeded devices to demo login accounts', async () => {
    for (const [email, password] of [
      ['itadmin@ricoz.local', 'itadmin123'],
      ['operator@ricoz.local', 'operator123'],
      ['viewer@ricoz.local', 'viewer123'],
    ] as const) {
      const token = await login(email, password);
      const res = await app.inject({
        method: 'GET',
        url: '/api/devices?limit=100',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json() as DeviceListBody;
      assert.ok(body.data.length >= 2, `${email} should see the scoped demo fixtures`);
      assert.ok(
        body.data.every((device) => device.isDemoSeed === true),
        `${email} should only see demo-seeded devices`
      );
      assert.ok(
        !body.data.some((device) => device.id === enrolledDeviceId),
        `${email} must not see really enrolled endpoints`
      );
    }
  });

  it('forces the demo scope even when source=ALL is requested', async () => {
    const token = await login('itadmin@ricoz.local', 'itadmin123');
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices?limit=100&source=ALL',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as DeviceListBody;
    assert.ok(body.data.every((device) => device.isDemoSeed === true));
    assert.ok(!body.data.some((device) => device.id === enrolledDeviceId));
  });

  it('supports source filtering for regular accounts', async () => {
    const token = await login('admin@ricoz.local', 'admin123');

    const seeded = await app.inject({
      method: 'GET',
      url: `/api/devices?limit=100&source=SEEDED&search=${encodeURIComponent('SN-REAL-')}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(seeded.statusCode, 200);
    assert.ok(
      !(seeded.json() as DeviceListBody).data.some((device) => device.id === enrolledDeviceId),
      'SEEDED must exclude really enrolled endpoints'
    );

    const enrolled = await app.inject({
      method: 'GET',
      url: `/api/devices?limit=100&source=ENROLLED&search=${encodeURIComponent('SN-REAL-')}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(enrolled.statusCode, 200);
    assert.ok(
      (enrolled.json() as DeviceListBody).data.some((device) => device.id === enrolledDeviceId),
      'ENROLLED must include really enrolled endpoints'
    );
  });

  it('hides really enrolled device detail from demo logins', async () => {
    const token = await login('operator@ricoz.local', 'operator123');
    const headers = { authorization: `Bearer ${token}` };

    const detail = await app.inject({ method: 'GET', url: `/api/devices/${enrolledDeviceId}`, headers });
    assert.equal(detail.statusCode, 404);

    const hardware = await app.inject({ method: 'GET', url: `/api/devices/${enrolledDeviceId}/hardware`, headers });
    assert.equal(hardware.statusCode, 404);

    const software = await app.inject({ method: 'GET', url: `/api/devices/${enrolledDeviceId}/software`, headers });
    assert.equal(software.statusCode, 404);

    const activity = await app.inject({ method: 'GET', url: `/api/devices/${enrolledDeviceId}/activity`, headers });
    assert.equal(activity.statusCode, 404);

    // Control: a non-demo admin still sees the enrolled endpoint.
    const adminToken = await login('admin@ricoz.local', 'admin123');
    const control = await app.inject({
      method: 'GET',
      url: `/api/devices/${enrolledDeviceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(control.statusCode, 200);
  });
});