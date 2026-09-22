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

  before(async () => {
    app = await buildApp();

    // Resolve seed organization + device
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
    // Clean up isolated tenant
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
    assert.ok(body.pagination.total >= 6, 'SUPER_ADMIN should see devices across all organizations');
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
      url: '/api/devices?search=SN-DEMO-002&limit=100',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data: { serialNumber: string; hostname: string }[] };
    assert.ok(body.data.length >= 1);
    assert.ok(body.data.some((device) => device.serialNumber === 'SN-DEMO-002'));

    const res2 = await app.inject({
      method: 'GET',
      url: '/api/devices?search=DESKTOP-WKS&limit=100',
      headers: authHeaders(token),
    });
    const body2 = res2.json() as { data: { hostname: string }[] };
    assert.ok(body2.data.length >= 1);
    assert.ok(body2.data.every((device) => device.hostname.toLowerCase().includes('desktop-wks')));
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
    assert.ok(body.data.length >= 1);
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
    assert.ok(swagger.paths['/api/devices/{id}']);
    assert.ok(swagger.paths['/api/devices/{id}/hardware']);
    assert.ok(swagger.paths['/api/devices/{id}/software']);
    assert.ok(swagger.paths['/api/devices/{id}/activity']);
  });
});