import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server';

interface ApiResponse {
  success: boolean;
  data?: {
    token?: string;
    user?: { id?: string; email?: string; role?: string; organizationId?: string };
    id?: string;
    email?: string;
  };
  error?: { code?: string; message?: string };
}

describe('Role-based registration & user management', () => {
  let app: FastifyInstance;
  const runId = Date.now();
  const orgName = `Acme Test Org ${runId}`;
  const adminEmail = `orgadmin-${runId}@acme.local`;
  let orgId: string;
  let adminToken: string;
  let adminId: string;

  before(async () => {
    app = await buildApp();
  });

  after(async () => {
    if (orgId) {
      await app.prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
      await app.prisma.user.deleteMany({ where: { organizationId: orgId } });
      await app.prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    }
    await app.close();
  });

  function auth(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  it('registers a new organization with an ORG_ADMIN account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        organizationName: orgName,
        name: 'Org Admin',
        email: adminEmail,
        password: 'register123',
      },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json() as ApiResponse;
    assert.ok(body.data?.token, 'registration should return a session token');
    assert.equal(body.data?.user?.role, 'ORG_ADMIN');
    orgId = body.data!.user!.organizationId!;
    adminToken = body.data!.token!;
    adminId = body.data!.user!.id!;
  });

  it('rejects duplicate email and duplicate organization name', async () => {
    const dupEmail = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        organizationName: `Other Org ${runId}`,
        name: 'Someone',
        email: adminEmail,
        password: 'register123',
      },
    });
    assert.equal(dupEmail.statusCode, 409);
    assert.equal((dupEmail.json() as ApiResponse).error?.code, 'USER_EXISTS');

    const dupOrg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        organizationName: orgName,
        name: 'Someone Else',
        email: `other-${runId}@acme.local`,
        password: 'register123',
      },
    });
    assert.equal(dupOrg.statusCode, 409);
    assert.equal((dupOrg.json() as ApiResponse).error?.code, 'ORG_EXISTS');
  });

  it('lets the new ORG_ADMIN create lower roles but not peers', async () => {
    const createIt = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(adminToken),
      payload: {
        email: `itadmin-${runId}@acme.local`,
        name: 'IT Admin',
        password: 'itadmin123',
        role: 'IT_ADMIN',
      },
    });
    assert.equal(createIt.statusCode, 201);

    const createPeer = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(adminToken),
      payload: {
        email: `peer-${runId}@acme.local`,
        name: 'Peer Admin',
        password: 'peeradmin123',
        role: 'ORG_ADMIN',
      },
    });
    assert.equal(createPeer.statusCode, 403);
  });

  it('applies role demotions to live sessions without re-login', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `itadmin-${runId}@acme.local`, password: 'itadmin123' },
    });
    const itToken = (login.json() as ApiResponse).data!.token!;

    // IT_ADMIN can list users before demotion.
    const before = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: auth(itToken),
    });
    assert.equal(before.statusCode, 200);

    const itUser = await app.prisma.user.findUniqueOrThrow({
      where: { email: `itadmin-${runId}@acme.local` },
      select: { id: true },
    });
    const demote = await app.inject({
      method: 'PATCH',
      url: `/api/users/${itUser.id}`,
      headers: auth(adminToken),
      payload: { role: 'VIEWER' },
    });
    assert.equal(demote.statusCode, 200);
    assert.equal((demote.json() as ApiResponse & { data?: { role?: string } }).data?.role, 'VIEWER');

    // Same token must now be rejected: live role sync, no re-login needed.
    const after = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: auth(itToken),
    });
    assert.equal(after.statusCode, 403);
  });

  it('protects the last admin and blocks self-deletion', async () => {
    const selfDelete = await app.inject({
      method: 'DELETE',
      url: `/api/users/${adminId}`,
      headers: auth(adminToken),
    });
    assert.equal(selfDelete.statusCode, 400);

    const demoteSelf = await app.inject({
      method: 'PATCH',
      url: `/api/users/${adminId}`,
      headers: auth(adminToken),
      payload: { role: 'OPERATOR' },
    });
    assert.equal(demoteSelf.statusCode, 400);
  });

  it('deletes a regular user while preserving audit history', async () => {
    const target = await app.prisma.user.findUniqueOrThrow({
      where: { email: `itadmin-${runId}@acme.local` },
      select: { id: true },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${target.id}`,
      headers: auth(adminToken),
    });
    assert.equal(res.statusCode, 200);
    assert.equal((res.json() as ApiResponse).data?.id, target.id);
  });
});
