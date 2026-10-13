import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

interface UserListPage {
  items: Array<{ id: string; email: string; name: string; role: string; isActive: boolean }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

describe('Users list pagination', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let viewerToken: string;
  let orgId: string;
  const runId = Date.now();
  const createdEmails: string[] = [];

  before(async () => {
    app = await buildApp();

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@ricoz.local', password: 'admin123' },
    });
    adminToken = (adminLogin.json() as LoginResponse).data!.token!;

    const admin = await app.prisma.user.findUniqueOrThrow({
      where: { email: 'admin@ricoz.local' },
      select: { organizationId: true },
    });
    orgId = admin.organizationId;

    const passwordHash = await hashPassword('tester123');
    const roles = ['VIEWER', 'OPERATOR', 'IT_ADMIN'] as const;
    for (const [index, role] of roles.entries()) {
      const email = `users-page-${runId}-${index}@ricoz.local`;
      createdEmails.push(email);
      await app.prisma.user.create({
        data: { organizationId: orgId, email, name: `Page Tester ${index}`, passwordHash, role },
      });
    }

    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'viewer@ricoz.local', password: 'viewer123' },
    });
    viewerToken = (viewerLogin.json() as LoginResponse).data!.token!;
  });

  after(async () => {
    await app.prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await app.close();
  });

  it('pages the directory instead of returning every user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users?page=1&limit=2',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const data = (res.json() as { data: UserListPage }).data;

    assert.equal(data.page, 1);
    assert.equal(data.limit, 2);
    assert.ok(data.items.length <= 2, 'a page never exceeds the requested limit');
    assert.ok(data.total >= 3, 'the test fixture users exist');
    assert.ok(data.totalPages >= 2, 'multiple pages exist');
  });

  it('returns a disjoint second page', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/api/users?page=1&limit=1',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const second = await app.inject({
      method: 'GET',
      url: '/api/users?page=2&limit=1',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const firstId = (first.json() as { data: UserListPage }).data.items[0]?.id;
    const secondId = (second.json() as { data: UserListPage }).data.items[0]?.id;

    assert.ok(firstId && secondId);
    assert.notEqual(firstId, secondId, 'pages must not overlap');
  });

  it('filters by search text on the server', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/users?limit=50&search=users-page-${runId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const data = (res.json() as { data: UserListPage }).data;

    assert.equal(data.total, 3);
    assert.equal(data.items.length, 3);
    assert.ok(data.items.every((user) => user.email.includes(`users-page-${runId}`)));
  });

  it('filters by role and by active status', async () => {
    const byRole = await app.inject({
      method: 'GET',
      url: `/api/users?limit=50&search=users-page-${runId}&role=OPERATOR`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const roleData = (byRole.json() as { data: UserListPage }).data;
    assert.equal(roleData.total, 1);
    assert.equal(roleData.items[0]?.role, 'OPERATOR');

    const byStatus = await app.inject({
      method: 'GET',
      url: `/api/users?limit=50&search=users-page-${runId}&isActive=true`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal((byStatus.json() as { data: UserListPage }).data.total, 3);
  });

  it('rejects a page size above the documented maximum', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users?limit=101',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as { success: boolean; error?: { code: string } };
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'VALIDATION_ERROR');
  });

  it('rejects an unknown role filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users?role=NOT_A_ROLE',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 400);
  });

  it('is not reachable below IT_ADMIN', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users' });
    assert.equal(res.statusCode, 401);
  });
});
