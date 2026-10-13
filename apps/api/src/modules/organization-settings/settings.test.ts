import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

interface SettingsResponse {
  success: boolean;
  data?: { settings: Record<string, unknown> };
}

describe('Organization settings', () => {
  let app: FastifyInstance;
  let orgAdminToken: string;
  let viewerToken: string;
  let orgId: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();

    const org = await app.prisma.organization.create({
      data: { name: `Settings-Test-${runId}` },
    });
    orgId = org.id;

    const passwordHash = await hashPassword('settings123');
    const adminUser = await app.prisma.user.create({
      data: {
        organizationId: orgId,
        email: `settings-admin-${runId}@ricoz.local`,
        name: 'Settings Admin',
        passwordHash,
        role: 'ORG_ADMIN',
      },
    });
    const viewerUser = await app.prisma.user.create({
      data: {
        organizationId: orgId,
        email: `settings-viewer-${runId}@ricoz.local`,
        name: 'Settings Viewer',
        passwordHash,
        role: 'VIEWER',
      },
    });

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: adminUser.email, password: 'settings123' },
    });
    orgAdminToken = (adminLogin.json() as LoginResponse).data!.token!;

    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: viewerUser.email, password: 'settings123' },
    });
    viewerToken = (viewerLogin.json() as LoginResponse).data!.token!;
  });

  after(async () => {
    await app.prisma.user.deleteMany({ where: { organizationId: orgId } });
    await app.prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    await app.close();
  });

  const getSettings = async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${orgAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    return (res.json() as SettingsResponse).data!.settings;
  };

  it('exposes the offline timeout alongside the heartbeat interval', async () => {
    const settings = await getSettings();
    assert.equal(settings.agentHeartbeatIntervalSeconds, 60);
    assert.equal(settings.offlineTimeoutMinutes, 15);
  });

  it('persists a new offline timeout', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${orgAdminToken}` },
      payload: { offlineTimeoutMinutes: 45 },
    });
    assert.equal(put.statusCode, 200);

    const settings = await getSettings();
    assert.equal(settings.offlineTimeoutMinutes, 45);
  });

  it('rejects an offline timeout outside the allowed range', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${orgAdminToken}` },
      payload: { offlineTimeoutMinutes: 0 },
    });
    assert.equal(put.statusCode, 400);
  });

  it('ignores settings keys the platform does not implement', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${orgAdminToken}` },
      payload: { requireMfa: true, autoApproveCriticalPatches: true },
    });
    assert.equal(put.statusCode, 200);

    const settings = await getSettings();
    assert.ok(!('requireMfa' in settings), 'requireMfa is not a real setting');
    assert.ok(!('autoApproveCriticalPatches' in settings), 'autoApproveCriticalPatches is not a real setting');
  });

  it('is read-only for viewers and closed to anonymous callers', async () => {
    const read = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(read.statusCode, 200, 'viewers can read settings');

    const write = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { offlineTimeoutMinutes: 5 },
    });
    assert.equal(write.statusCode, 403);

    const anonymous = await app.inject({ method: 'GET', url: '/api/settings' });
    assert.equal(anonymous.statusCode, 401);
  });
});
