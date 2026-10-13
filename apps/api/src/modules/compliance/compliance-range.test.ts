import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

interface RollupResponse {
  success: boolean;
  data?: {
    controls: Array<{
      id: string;
      name: string;
      compliantCount: number;
      nonCompliantCount: number;
      status: string;
    }>;
  };
}

describe('Compliance rollup reporting range', () => {
  let app: FastifyInstance;
  let token: string;
  let orgId: string;
  let deviceId: string;
  let ruleId: string;
  const runId = Date.now();
  const ruleName = `Range rule ${runId}`;

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.create({ data: { name: `Range-Test-${runId}` } });
    orgId = org.id;

    const user = await app.prisma.user.create({
      data: {
        organizationId: orgId,
        email: `range-admin-${runId}@ricoz.local`,
        name: 'Range Admin',
        passwordHash: await hashPassword('range1234'),
        role: 'ORG_ADMIN',
      },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: 'range1234' },
    });
    token = (login.json() as LoginResponse).data!.token!;

    const rule = await app.prisma.complianceRule.create({
      data: { organizationId: orgId, name: ruleName, ruleType: 'OS_VERSION' },
    });
    ruleId = rule.id;

    const device = await app.prisma.device.create({
      data: {
        organizationId: orgId,
        deviceName: `RANGE-DEVICE-${runId}`,
        hostname: `range-host-${runId}`,
        serialNumber: `SN-RANGE-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        status: 'ONLINE',
        architecture: 'x64',
      },
    });
    deviceId = device.id;

    // A failing evaluation from 40 days ago: only "All time" should count it.
    await app.prisma.complianceResult.create({
      data: {
        deviceId,
        ruleId,
        status: 'NON_COMPLIANT',
        reason: 'stale finding outside the default window',
        evaluatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      },
    });
  });

  after(async () => {
    await app.prisma.complianceResult.deleteMany({ where: { deviceId } });
    await app.prisma.complianceRule.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.device.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.user.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    await app.close();
  });

  const rollup = async (range: string) => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/compliance?range=${range}&status=ALL&limit=100`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
    const data = (res.json() as RollupResponse).data!;
    const control = data.controls.find((row) => row.name === ruleName);
    assert.ok(control, `control "${ruleName}" is always listed`);
    return control;
  };

  it('ignores an old evaluation inside the 24h window', async () => {
    const control = await rollup('24h');
    assert.equal(control.nonCompliantCount, 0, '40 days ago is outside 24h');
    assert.equal(control.compliantCount, 0);
  });

  it('ignores the same evaluation inside the 30d window', async () => {
    const control = await rollup('30d');
    assert.equal(control.nonCompliantCount, 0, '40 days ago is outside 30d');
  });

  it('counts the evaluation when the range is "all time"', async () => {
    const control = await rollup('all');
    assert.equal(control.nonCompliantCount, 1, 'all-time range must see the stored result');
  });
});
