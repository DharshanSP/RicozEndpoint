import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

interface AlertListData {
  items: Array<{ id: string; title: string; message: string; status: string; deviceId: string | null }>;
  total: number;
  page: number;
  limit: number;
}

interface AlertData {
  id: string;
  status: string;
  acknowledgedNote: string | null;
  resolvedNote: string | null;
  organizationId: string;
}

const get = (app: FastifyInstance, url: string, token: string) =>
  app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

const post = (app: FastifyInstance, url: string, token: string, payload: Record<string, unknown> = {}) =>
  app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` }, payload });

describe('Alerts API (list, ack, resolve, batch, create, isolation)', () => {
  let app: FastifyInstance;
  let orgId: string;
  let otherOrgId: string;
  let demoDeviceId: string;
  let realDeviceId: string;
  let adminToken: string;
  let itAdminToken: string;
  let operatorToken: string;
  let viewerToken: string;
  let demoToken: string;
  const runId = Date.now();
  const marker = `ALERTS-${runId}`;

  const alertIds: string[] = [];

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.create({ data: { name: `Alerts-Test-${runId}` } });
    orgId = org.id;
    const other = await app.prisma.organization.create({ data: { name: `Alerts-Foreign-${runId}` } });
    otherOrgId = other.id;

    const makeUser = async (email: string, role: 'ORG_ADMIN' | 'IT_ADMIN' | 'OPERATOR' | 'VIEWER', demo = false) => {
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

    adminToken = await makeUser(`alerts-admin-${runId}@ricoz.local`, 'ORG_ADMIN');
    itAdminToken = await makeUser(`alerts-it-${runId}@ricoz.local`, 'IT_ADMIN');
    operatorToken = await makeUser(`alerts-op-${runId}@ricoz.local`, 'OPERATOR');
    viewerToken = await makeUser(`alerts-viewer-${runId}@ricoz.local`, 'VIEWER');
    demoToken = await makeUser(`alerts-demo-${runId}@ricoz.local`, 'IT_ADMIN', true);

    const makeDevice = (suffix: string, demo: boolean) =>
      app.prisma.device.create({
        data: {
          organizationId: orgId,
          deviceName: `${marker}-DEV-${suffix}`,
          hostname: `${marker.toLowerCase()}-host-${suffix}`,
          serialNumber: `SN-${marker}-${suffix}`,
          os: 'Windows',
          osVersion: 'Windows 11',
          status: 'ONLINE',
          architecture: 'x64',
          ...(demo ? { isDemoSeed: true } : {}),
        },
      });

    demoDeviceId = (await makeDevice('DEMO', true)).id;
    realDeviceId = (await makeDevice('REAL', false)).id;
  });

  after(async () => {
    await app.prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
    await app.prisma.alert.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
    await app.prisma.device.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
    await app.prisma.user.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
    await app.close();
  });

  // Unique dedup keys per fixture: keyless alerts in one org/type would
  // otherwise collapse into a single deduplicated row (200, not 201).
  let alertSeq = 0;
  const createAlert = async (
    token: string,
    payload: Record<string, unknown>,
    expectedStatus = 201
  ): Promise<AlertData> => {
    const res = await post(app, '/api/alerts', token, {
      dedupKey: `test-${runId}-${alertSeq++}`,
      ...payload,
    });
    assert.equal(res.statusCode, expectedStatus);
    const body = res.json() as { success: boolean; data: AlertData };
    if (expectedStatus === 201) alertIds.push(body.data.id);
    return body.data;
  };

  it('lists with org-wide totals across pages', async () => {
    for (let i = 0; i < 3; i += 1) {
      await createAlert(adminToken, {
        type: 'INFO',
        severity: 'INFO',
        title: `${marker} total ${i}`,
        message: 'pagination probe',
      });
    }
    const res = await get(app, '/api/alerts?limit=2', adminToken);
    assert.equal(res.statusCode, 200);
    const body = (res.json() as { data: AlertListData }).data;
    assert.equal(body.items.length, 2);
    assert.ok(body.total >= 3, `total must cover all rows, got ${body.total}`);
  });

  it('searches titles and messages', async () => {
    const unique = `needle-${runId}`;
    await createAlert(adminToken, {
      type: 'INFO',
      severity: 'INFO',
      title: `${marker} plain title`,
      message: `body contains ${unique}`,
    });
    const byMessage = await get(app, `/api/alerts?search=${unique}`, adminToken);
    assert.equal(byMessage.statusCode, 200);
    const items = (byMessage.json() as { data: AlertListData }).data.items;
    assert.ok(items.length >= 1);
    assert.ok(items.every((a) => a.title.includes(marker) || a.message.includes(unique)));
  });

  it('filters by deviceId', async () => {
    await createAlert(adminToken, {
      deviceId: demoDeviceId,
      type: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      title: `${marker} demo device alert`,
      message: 'scoped probe',
    });
    const res = await get(app, `/api/alerts?deviceId=${demoDeviceId}`, adminToken);
    assert.equal(res.statusCode, 200);
    const items = (res.json() as { data: AlertListData }).data.items;
    assert.ok(items.length >= 1);
    assert.ok(items.every((a) => a.deviceId === demoDeviceId));
  });

  it('hides real-device alerts from demo logins', async () => {
    const real = await createAlert(adminToken, {
      deviceId: realDeviceId,
      type: 'SECURITY',
      severity: 'CRITICAL',
      title: `${marker} real device alert`,
      message: 'must stay hidden from demo',
    });

    const list = await get(app, '/api/alerts', demoToken);
    assert.equal(list.statusCode, 200);
    const items = (list.json() as { data: AlertListData }).data.items;
    assert.ok(!items.some((a) => a.id === real.id), 'demo list must not include real-device alerts');

    const direct = await get(app, `/api/alerts/${real.id}`, demoToken);
    assert.equal(direct.statusCode, 404);

    const resolve = await post(app, `/api/alerts/${real.id}/resolve`, demoToken, {});
    assert.equal(resolve.statusCode, 404);
  });

  it('acknowledges with a dedicated ack note (OPERATOR+, VIEWER forbidden)', async () => {
    const alert = await createAlert(adminToken, {
      type: 'POLICY',
      severity: 'WARNING',
      title: `${marker} ack me`,
      message: 'ack probe',
    });

    const viewerAck = await post(app, `/api/alerts/${alert.id}/acknowledge`, viewerToken, { note: 'nope' });
    assert.equal(viewerAck.statusCode, 403);

    const ack = await post(app, `/api/alerts/${alert.id}/acknowledge`, operatorToken, { note: 'triaged by ops' });
    assert.equal(ack.statusCode, 200);
    const acked = (ack.json() as { data: AlertData }).data;
    assert.equal(acked.status, 'ACKNOWLEDGED');
    assert.equal(acked.acknowledgedNote, 'triaged by ops');
    assert.equal(acked.resolvedNote, null);

    const again = await post(app, `/api/alerts/${alert.id}/acknowledge`, operatorToken, {});
    assert.equal(again.statusCode, 409);
  });

  it('resolves with a note (IT_ADMIN+, VIEWER forbidden, no double resolve)', async () => {
    const alert = await createAlert(adminToken, {
      type: 'POLICY',
      severity: 'WARNING',
      title: `${marker} resolve me`,
      message: 'resolve probe',
    });

    const viewerResolve = await post(app, `/api/alerts/${alert.id}/resolve`, viewerToken, {});
    assert.equal(viewerResolve.statusCode, 403);

    const resolve = await post(app, `/api/alerts/${alert.id}/resolve`, itAdminToken, { note: 'fixed' });
    assert.equal(resolve.statusCode, 200);
    const resolved = (resolve.json() as { data: AlertData }).data;
    assert.equal(resolved.status, 'RESOLVED');
    assert.equal(resolved.resolvedNote, 'fixed');

    const again = await post(app, `/api/alerts/${alert.id}/resolve`, itAdminToken, {});
    assert.equal(again.statusCode, 409);

    const ackResolved = await post(app, `/api/alerts/${alert.id}/acknowledge`, operatorToken, {});
    assert.equal(ackResolved.statusCode, 409);
  });

  it('batch-resolves with per-org audit rows', async () => {
    const first = await createAlert(adminToken, {
      type: 'INFO',
      severity: 'INFO',
      title: `${marker} batch 1`,
      message: 'batch probe',
    });
    const second = await createAlert(adminToken, {
      type: 'INFO',
      severity: 'INFO',
      title: `${marker} batch 2`,
      message: 'batch probe',
    });
    await post(app, `/api/alerts/${second.id}/resolve`, itAdminToken, {});

    const res = await post(app, '/api/alerts/batch-resolve', itAdminToken, {
      ids: [first.id, second.id, '00000000-0000-0000-0000-000000000000'],
      note: 'bulk',
    });
    assert.equal(res.statusCode, 200);
    const body = (res.json() as { data: { requested: number; matched: number; resolved: number; notFound: number } }).data;
    assert.deepEqual(body, { requested: 3, matched: 2, resolved: 1, notFound: 1 });

    const audits = await app.prisma.auditLog.findMany({
      where: { organizationId: orgId, action: 'ALERTS_BATCH_RESOLVED' },
      orderBy: { timestamp: 'desc' },
      take: 1,
    });
    assert.equal(audits.length, 1);
    assert.match(audits[0]!.resourceId, new RegExp(`^${first.id}|alert-batch`));
  });

  it('stamps manual alerts with the device organization (SUPER_ADMIN cross-org)', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    const superToken = (login.json() as LoginResponse).data!.token!;

    const created = await createAlert(
      superToken,
      {
        deviceId: realDeviceId,
        type: 'SECURITY',
        severity: 'CRITICAL',
        title: `${marker} super raised`,
        message: 'cross-org probe',
      },
      201
    );
    assert.equal(created.organizationId, orgId, 'alert must belong to the device org, not the session org');
  });

  it('isolates organizations (404 across tenants)', async () => {
    const foreign = await app.prisma.alert.create({
      data: {
        organizationId: otherOrgId,
        type: 'SECURITY',
        severity: 'CRITICAL',
        title: `${marker} foreign`,
        message: 'must not leak',
        status: 'OPEN',
      },
    });

    const res = await get(app, `/api/alerts/${foreign.id}`, adminToken);
    assert.equal(res.statusCode, 404);

    const list = await get(app, '/api/alerts', adminToken);
    const items = (list.json() as { data: AlertListData }).data.items;
    assert.ok(!items.some((a) => a.id === foreign.id));
  });
});
