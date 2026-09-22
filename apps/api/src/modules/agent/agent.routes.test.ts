import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
  error?: { code?: string; message?: string };
}

interface TokenData {
  token?: string;
  id?: string;
}

interface EnrollResponse {
  success: boolean;
  data?: { deviceId?: string; agentToken?: string };
  error?: { code?: string; message?: string };
}

describe('Agent API (heartbeat, telemetry, commands)', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let deviceId: string;
  let agentToken: string;
  let agentToken2: string;
  let otherDeviceId: string;
  let demoOrgId: string;
  let enrollmentTokenId: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    demoOrgId = org.id;

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    const loginBody = loginRes.json() as LoginResponse;
    adminToken = loginBody.data!.token!;

    // Enroll two devices to get agent tokens
    const enroll1 = await app.inject({
      method: 'POST',
      url: '/api/enroll',
      payload: {
        enrollmentToken: await makeEnrollmentToken(),
        hostname: `AGENT-HOST-${runId}`,
        serialNumber: `SN-AGENT-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11 Pro 24H2',
        agentVersion: '0.1.0',
      },
    });
    const e1 = enroll1.json() as EnrollResponse;
    assert.ok(enroll1.statusCode === 201 && e1.data?.deviceId && e1.data?.agentToken);
    deviceId = e1.data.deviceId;
    agentToken = e1.data.agentToken;

    const enroll2 = await app.inject({
      method: 'POST',
      url: '/api/enroll',
      payload: {
        enrollmentToken: await makeEnrollmentToken(),
        hostname: `AGENT-OTHER-${runId}`,
        serialNumber: `SN-AGENT2-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 10',
        agentVersion: '0.1.0',
      },
    });
    const e2 = enroll2.json() as EnrollResponse;
    assert.ok(enroll2.statusCode === 201 && e2.data?.deviceId && e2.data?.agentToken);
    otherDeviceId = e2.data.deviceId;
    agentToken2 = e2.data.agentToken;

    async function makeEnrollmentToken(): Promise<string> {
      const res = await app.inject({
        method: 'POST',
        url: '/api/enrollment-tokens',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { maxUses: 5 },
      });
      const body = res.json() as { data?: TokenData };
      enrollmentTokenId = body.data!.id!;
      return body.data!.token!;
    }
  });

  after(async () => {
    for (const id of [deviceId, otherDeviceId]) {
      await app.prisma.enrollmentToken.deleteMany({ where: { deviceId: id } });
      await app.prisma.device.delete({ where: { id } }).catch(() => undefined);
    }
    if (enrollmentTokenId) {
      await app.prisma.enrollmentToken.delete({ where: { id: enrollmentTokenId } }).catch(() => undefined);
    }
    await app.close();
  });

  function agentHeaders(token?: string) {
    return token ? { 'x-agent-token': token } : {};
  }

  function heartbeatBody(overrides: Record<string, unknown> = {}) {
    return {
      deviceId,
      agentVersion: '0.1.0',
      timestamp: new Date().toISOString(),
      status: 'ONLINE',
      ...overrides,
    };
  }

  it('rejects heartbeat without an agent token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/agent/heartbeat', payload: heartbeatBody() });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error?.code, 'AGENT_TOKEN_REQUIRED');
  });

  it('rejects heartbeat with an invalid agent token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: agentHeaders('agtk_invalid-token'),
      payload: heartbeatBody(),
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error?.code, 'INVALID_AGENT_TOKEN');
  });

  it('rejects heartbeat for a mismatched deviceId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: agentHeaders(agentToken),
      payload: heartbeatBody({ deviceId: otherDeviceId }),
    });
    assert.equal(res.statusCode, 403);
  });

  it('accepts heartbeat with hardware + software telemetry', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: agentHeaders(agentToken),
      payload: heartbeatBody({
        hardware: {
          hostname: `AGENT-HOST-${runId}`,
          cpu: 'Intel Core i9-13900K',
          cpuCores: 24,
          ramBytes: 34359738368,
          storageBytes: 1099511627776,
          manufacturer: 'Dell',
          model: 'Precision 7960',
          serialNumber: `SN-AGENT-${runId}`,
          biosVersion: '2.14.0',
          os: 'Windows',
          osVersion: 'Windows 11 Pro 24H2',
          architecture: 'x64',
        },
        software: {
          items: [
            { name: 'Google Chrome', version: '126.0.6478.183', publisher: 'Google LLC', installDate: null, architecture: 'x64' },
            { name: '7-Zip', version: '24.08', publisher: 'Igor Pavlov', installDate: '2025-06-01T00:00:00.000Z', architecture: 'x64' },
          ],
        },
      }),
    });
    assert.equal(res.statusCode, 200);

    const body = res.json() as {
      data?: { device?: { status?: string; lastSeenAt?: string }; pendingCommands?: unknown[] };
    };
    assert.equal(body.data?.device?.status, 'ONLINE');
    assert.ok(typeof body.data?.device?.lastSeenAt === 'string');
    assert.deepEqual(body.data?.pendingCommands, []);

    const device = await app.prisma.device.findUniqueOrThrow({
      where: { id: deviceId },
      include: { hardware: true, software: true, heartbeats: { take: 5, orderBy: { timestamp: 'desc' } } },
    });
    assert.equal(device.status, 'ONLINE');
    assert.ok(device.lastSeenAt);
    assert.ok(device.hardware, 'hardware inventory stored');
    assert.equal(device.hardware.cpu, 'Intel Core i9-13900K');
    assert.equal(device.hardware.ramBytes.toString(), '34359738368');
    assert.equal(device.software.length, 2);
    const names = device.software.map((s) => s.name);
    assert.ok(names.includes('Google Chrome') && names.includes('7-Zip'));
    assert.ok(device.heartbeats.length >= 1);
  });

  it('replaces software inventory on a later heartbeat', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: agentHeaders(agentToken),
      payload: heartbeatBody({
        software: {
          items: [{ name: 'Google Chrome', version: '127.0.0.1', publisher: 'Google LLC', installDate: null, architecture: 'x64' }],
        },
      }),
    });
    assert.equal(res.statusCode, 200);

    const device = await app.prisma.device.findUniqueOrThrow({
      where: { id: deviceId },
      include: { software: true },
    });
    assert.equal(device.software.length, 1, 'stale software entries removed');
    assert.equal(device.software[0]?.name, 'Google Chrome');
    assert.equal(device.software[0]?.version, '127.0.0.1');
  });

  it('returns pending commands in heartbeat and stores execution result', async () => {
    const command = await app.prisma.command.create({
      data: {
        organizationId: demoOrgId,
        deviceId,
        type: 'REFRESH_INVENTORY',
        status: 'PENDING',
        requestedBy: null,
      },
    });

    const hb = await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: agentHeaders(agentToken),
      payload: heartbeatBody(),
    });
    const hbBody = hb.json() as { data?: { pendingCommands?: { id: string; type: string }[] } };
    assert.equal(hb.statusCode, 200);
    assert.equal(hbBody.data?.pendingCommands?.length, 1);
    assert.equal(hbBody.data?.pendingCommands?.[0]?.id, command.id);

    const result = await app.inject({
      method: 'POST',
      url: `/api/agent/commands/${command.id}/result`,
      headers: agentHeaders(agentToken),
      payload: { status: 'COMPLETED', result: 'Inventory refreshed (24 apps, 1 hardware profile)' },
    });
    assert.equal(result.statusCode, 200);
    const resultBody = result.json() as { data?: { status?: string; completedAt?: string; result?: string } };
    assert.equal(resultBody.data?.status, 'COMPLETED');
    assert.ok(resultBody.data?.completedAt);
    assert.ok(resultBody.data?.result?.includes('Inventory refreshed'));

    const hb2 = await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: agentHeaders(agentToken),
      payload: heartbeatBody(),
    });
    const hb2Body = hb2.json() as { data?: { pendingCommands?: unknown[] } };
    assert.equal(hb2Body.data?.pendingCommands?.length, 0, 'completed command no longer pending');
  });

  it('prevents reporting results for commands of other devices', async () => {
    const command = await app.prisma.command.create({
      data: { organizationId: demoOrgId, deviceId, type: 'RESTART_DEVICE', status: 'PENDING' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/agent/commands/${command.id}/result`,
      headers: agentHeaders(agentToken2),
      payload: { status: 'COMPLETED' },
    });
    assert.equal(res.statusCode, 404);
  });

  it('lists pending commands via explicit pull endpoint', async () => {
    const command = await app.prisma.command.create({
      data: { organizationId: demoOrgId, deviceId, type: 'SYNC_POLICY', status: 'PENDING' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/commands/pending',
      headers: agentHeaders(agentToken),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { data?: { commands?: { id: string }[] } };
    assert.ok(body.data?.commands?.some((c) => c.id === command.id));
  });

  it('marks a device OFFLINE gracefully via heartbeat', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/heartbeat',
      headers: agentHeaders(agentToken2),
      payload: {
        deviceId: otherDeviceId,
        agentVersion: '0.1.0',
        timestamp: new Date().toISOString(),
        status: 'OFFLINE',
      },
    });
    assert.equal(res.statusCode, 200);
    const device = await app.prisma.device.findUniqueOrThrow({
      where: { id: otherDeviceId },
      select: { status: true },
    });
    assert.equal(device.status, 'OFFLINE');
  });
});