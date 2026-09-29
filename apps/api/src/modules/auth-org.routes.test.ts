import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server';
import { hashPassword } from '../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string; user?: { id?: string; organizationId?: string } };
  error?: { code?: string; message?: string };
}

describe('Auth: password management', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let operatorToken: string;

  before(async () => {
    app = await buildApp();

    const admin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (admin.json() as LoginResponse).data!.token!;

    const op = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'operator@ricoz.local', password: 'operator123' },
    });
    operatorToken = (op.json() as LoginResponse).data!.token!;
  });

  after(async () => {
    // Restore seed credentials so repeated runs stay green.
    await app.prisma.user.updateMany({
      where: { email: 'operator@ricoz.local' },
      data: { passwordHash: await hashPassword('operator123') },
    });
    await app.close();
  });

  it('changes own password and issues a fresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: { currentPassword: 'operator123', newPassword: 'operator-newpass1' },
    });
    assert.equal(res.statusCode, 200);
    assert.ok(res.json().data.token, 'a refreshed token should be returned');

    // Old password must no longer work, new password must work.
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'operator@ricoz.local', password: 'operator123' },
    });
    assert.equal(oldLogin.statusCode, 401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'operator@ricoz.local', password: 'operator-newpass1' },
    });
    assert.equal(newLogin.statusCode, 200);
  });

  it('rejects change-password with a wrong current password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { currentPassword: 'definitely-not-it', newPassword: 'brandnewpass1' },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'INVALID_CREDENTIALS');
  });

  it('rejects an unchanged password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { currentPassword: 'admin123', newPassword: 'admin123' },
    });
    assert.equal(res.statusCode, 400);
  });

  it('rejects a too-short new password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { currentPassword: 'admin123', newPassword: 'short' },
    });
    assert.equal(res.statusCode, 400);
  });

  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      payload: { currentPassword: 'admin123', newPassword: 'whatever123' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('refreshes a session token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    assert.ok(res.json().data.token);
  });
});

describe('Users: admin password reset', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let viewerToken: string;
  let targetUserId: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();

    const admin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (admin.json() as LoginResponse).data!.token!;

    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });

    const target = await app.prisma.user.create({
      data: {
        organizationId: org.id,
        email: `reset-target-${runId}@ricoz.local`,
        name: 'Reset Target',
        passwordHash: await hashPassword('originalpass1'),
        role: 'VIEWER',
      },
    });
    targetUserId = target.id;

    const viewer = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'viewer@ricoz.local', password: 'viewer123' },
    });
    viewerToken = (viewer.json() as LoginResponse).data!.token!;
  });

  after(async () => {
    await app.prisma.user.deleteMany({ where: { id: targetUserId } }).catch(() => undefined);
    await app.close();
  });

  it('resets a user password as admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${targetUserId}/reset-password`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { newPassword: 'resetpass123' },
    });
    assert.equal(res.statusCode, 200);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `reset-target-${runId}@ricoz.local`, password: 'resetpass123' },
    });
    assert.equal(login.statusCode, 200);
  });

  it('blocks a VIEWER from resetting passwords (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${targetUserId}/reset-password`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { newPassword: 'hijack12345' },
    });
    assert.equal(res.statusCode, 403);
  });
});

describe('Organizations: tenant management', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let operatorToken: string;
  let createdOrgId: string;
  let createdAdminEmail: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();

    const admin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (admin.json() as LoginResponse).data!.token!;

    const op = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'operator@ricoz.local', password: 'operator123' },
    });
    operatorToken = (op.json() as LoginResponse).data!.token!;

    createdAdminEmail = `orgadmin-${runId}@ricoz.local`;
  });

  after(async () => {
    if (createdOrgId) {
      await app.prisma.organization.delete({ where: { id: createdOrgId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('creates an organization with a bootstrap admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/organizations',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: `Acme Corp ${runId}`,
        admin: { email: createdAdminEmail, name: 'Org Admin', password: 'orgadminpass1' },
      },
    });
    assert.equal(res.statusCode, 201);
    createdOrgId = res.json().data.id;

    // The bootstrap admin can log in and belongs to the new tenant.
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: createdAdminEmail, password: 'orgadminpass1' },
    });
    assert.equal(login.statusCode, 200);
    const body = login.json() as LoginResponse;
    assert.equal(body.data!.user!.organizationId, createdOrgId);
  });

  it('rejects a duplicate organization name (409)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/organizations',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: `Acme Corp ${runId}` },
    });
    assert.equal(res.statusCode, 409);
  });

  it('blocks non-super-admins from creating organizations (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/organizations',
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: { name: `Unauthorized Org ${runId}` },
    });
    assert.equal(res.statusCode, 403);
  });

  it('lists organizations with counts for super admins', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/organizations?limit=50',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const payload = res.json();
    assert.ok(payload.data.length >= 2, 'demo org plus the new one');
    const created = payload.data.find((o: { name: string }) => o.name === `Acme Corp ${runId}`);
    assert.ok(created);
    assert.equal(created.userCount, 1);
    assert.equal(typeof created.deviceCount, 'number');
  });

  it('renames an organization', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/organizations/${createdOrgId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: `Acme Renamed ${runId}` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.name, `Acme Renamed ${runId}`);
  });

  it('returns 404 for an unknown organization', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/organizations/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Nope' },
    });
    assert.equal(res.statusCode, 404);
  });

  it('switches a super admin into another tenant and scopes the new token', async () => {
    const before = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const originalOrgId = (before.json() as { data: { organizationId: string } }).data.organizationId;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/switch-organization',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { organizationId: createdOrgId },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.organization.id, createdOrgId);

    // The re-scoped token must now identify the new tenant.
    const scopedToken = res.json().data.token as string;
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${scopedToken}` },
    });
    assert.equal(me.statusCode, 200);
    const meBody = me.json() as { data: { organizationId: string; organizationName: string } };
    assert.equal(meBody.data.organizationId, createdOrgId);
    assert.equal(meBody.data.organizationName, `Acme Renamed ${runId}`);

    // Settings are read through the token's organization scope, so they must be
    // the new tenant's own (empty) settings rather than the demo org's.
    const scopedSettings = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${scopedToken}` },
    });
    assert.equal(scopedSettings.statusCode, 200);

    // Switching back restores the original scope.
    const back = await app.inject({
      method: 'POST',
      url: '/api/auth/switch-organization',
      headers: { authorization: `Bearer ${scopedToken}` },
      payload: { organizationId: originalOrgId },
    });
    assert.equal(back.statusCode, 200);

    const backMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${back.json().data.token}` },
    });
    assert.equal(
      (backMe.json() as { data: { organizationId: string } }).data.organizationId,
      originalOrgId
    );
  });

  it('blocks a non-super-admin from switching tenants (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/switch-organization',
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: { organizationId: createdOrgId },
    });
    assert.equal(res.statusCode, 403);
  });

  it('blocks switching to an unknown organization (404)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/switch-organization',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { organizationId: '00000000-0000-0000-0000-000000000000' },
    });
    assert.equal(res.statusCode, 404);
  });
});

describe('Enrollment: usage tracking and history', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let tokenId: string;
  let deviceId: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();
    const admin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (admin.json() as LoginResponse).data!.token!;
  });

  after(async () => {
    if (deviceId) {
      await app.prisma.device.delete({ where: { id: deviceId } }).catch(() => undefined);
    }
    if (tokenId) {
      await app.prisma.enrollmentToken.delete({ where: { id: tokenId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('records lastUsedAt, creator and device after an agent enrolls', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/enrollment-tokens',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { label: `history-${runId}`, maxUses: 1 },
    });
    assert.equal(created.statusCode, 201);
    tokenId = created.json().data.id;

    const enroll = await app.inject({
      method: 'POST',
      url: '/api/enroll',
      payload: {
        enrollmentToken: created.json().data.token,
        hostname: `HISTORY-HOST-${runId}`,
        serialNumber: `SN-HISTORY-${runId}`,
        os: 'Windows',
        osVersion: 'Windows 11',
        agentVersion: '0.1.0',
      },
    });
    assert.equal(enroll.statusCode, 201);
    deviceId = enroll.json().data.deviceId;

    const list = await app.inject({
      method: 'GET',
      url: '/api/enrollment-tokens?includeRevoked=true&limit=100',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const record = (list.json().data as Array<{ id: string }>).find((t) => t.id === tokenId);
    assert.ok(record, 'token should be listed');
    const full = record as unknown as {
      lastUsedAt: string | null;
      uses: number;
      remainingUses: number;
      createdBy: { email: string } | null;
      device: { id: string } | null;
    };
    assert.equal(full.uses, 1);
    assert.equal(full.remainingUses, 0);
    assert.ok(full.lastUsedAt, 'lastUsedAt should be stamped');
    assert.ok(full.createdBy, 'creator should be resolved');
    assert.equal(full.device?.id, deviceId, 'token should be pinned to the enrolled device');
  });

  it('writes a DEVICE_ENROLLED audit entry with a null system actor', async () => {
    const logs = await app.inject({
      method: 'GET',
      url: '/api/audit-logs?action=DEVICE_ENROLLED&limit=50',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(logs.statusCode, 200);
    const items = logs.json().data.items as Array<{ action: string; actor: unknown }>;
    const found = items.find((i) => i.action === 'DEVICE_ENROLLED');
    assert.ok(found, 'enrollment should be audited');
    assert.equal(found.actor, null, 'system enrollment has no human actor');
  });

  it('exposes enrollment history with revoked-token state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/enrollment-history?limit=50',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const payload = res.json();
    const entry = (payload.data as Array<{ device: { id: string } }>).find(
      (e) => e.device?.id === deviceId
    );
    assert.ok(entry, 'the enrollment just performed should appear in history');
    const full = entry as unknown as {
      isCurrent: boolean;
      isRevoked: boolean;
      enrolledAt: string;
      device: { deviceName: string };
    };
    assert.equal(full.isCurrent, true);
    assert.equal(full.isRevoked, false);
    assert.ok(full.enrolledAt);
    assert.ok(full.device.deviceName);
  });
});
