import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { hashPassword } from '../../utils/password';

interface LoginResponse {
  success: boolean;
  data?: { token?: string };
}

interface TokenRequestSummary {
  id: string;
  label: string;
  requestNote: string;
  maxUses: number;
  expiresAt: string | null;
  status: string;
  adminNote: string;
  tokenRevealed: boolean;
  requestedBy: { id: string; email: string; name: string } | null;
  decidedBy: { id: string; email: string; name: string } | null;
  issuedToken: {
    id: string;
    label: string;
    expiresAt: string | null;
    maxUses: number;
    uses: number;
    isActive: boolean;
  } | null;
}

interface TokenRequestResponse {
  success: boolean;
  data?: TokenRequestSummary;
  error?: { code?: string; message?: string };
}

interface IssuedTokenResponse {
  success: boolean;
  data?: { requestId: string; id: string; token: string };
  error?: { code?: string; message?: string };
}

describe('Enrollment Token Requests API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let orgAdminToken: string;
  let operatorToken: string;
  let viewerToken: string;
  let foreignOperatorToken: string;
  let foreignRequestId: string;
  const runId = `${Date.now()}-${process.pid}`;
  const cleanupRequestIds: string[] = [];
  const cleanupTokenIds: string[] = [];
  const cleanupUserIds: string[] = [];
  const cleanupOrgIds: string[] = [];
  const cleanupAuditResourceIds: string[] = [];

  async function login(email: string, password: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    const body = res.json() as LoginResponse;
    assert.ok(res.statusCode === 200 && body.data?.token, `${email} should log in`);
    return body.data!.token!;
  }

  function headers(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  async function createRequest(
    token: string,
    payload: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: TokenRequestResponse }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/enrollment-token-requests',
      headers: headers(token),
      payload,
    });
    const body = res.json() as TokenRequestResponse;
    if (res.statusCode === 201 && body.data?.id) {
      cleanupRequestIds.push(body.data.id);
      cleanupAuditResourceIds.push(body.data.id);
    }
    return { statusCode: res.statusCode, body };
  }

  async function approveRequest(token: string, id: string, adminNote = '') {
    return app.inject({
      method: 'POST',
      url: `/api/enrollment-token-requests/${id}/approve`,
      headers: headers(token),
      payload: { adminNote },
    });
  }

  async function revealToken(token: string, id: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/enrollment-token-requests/${id}/token`,
      headers: headers(token),
    });
    const body = res.json() as IssuedTokenResponse;
    if (res.statusCode === 200 && body.data?.id) {
      cleanupTokenIds.push(body.data.id);
      cleanupAuditResourceIds.push(body.data.id);
    }
    return { statusCode: res.statusCode, body };
  }

  before(async () => {
    app = await buildApp();

    adminToken = await login('admin@ricoz.local', 'admin123');
    orgAdminToken = await login('orgadmin@ricoz.local', 'orgadmin123');
    operatorToken = await login('operator@ricoz.local', 'operator123');
    viewerToken = await login('viewer@ricoz.local', 'viewer123');

    const foreignOrg = await app.prisma.organization.create({ data: { name: `Token-Request-Foreign-${runId}` } });
    cleanupOrgIds.push(foreignOrg.id);
    const foreignOperator = await app.prisma.user.create({
      data: {
        organizationId: foreignOrg.id,
        email: `foreign-operator-${runId}@ricoz.local`,
        name: 'Foreign Operator',
        passwordHash: await hashPassword('operator123'),
        role: 'OPERATOR',
      },
    });
    cleanupUserIds.push(foreignOperator.id);
    cleanupAuditResourceIds.push(foreignOperator.id);
    foreignOperatorToken = await login(foreignOperator.email, 'operator123');
    const foreign = await createRequest(foreignOperatorToken, {
      label: `Foreign request ${runId}`,
      requestNote: 'Foreign request must stay isolated',
    });
    assert.equal(foreign.statusCode, 201);
    foreignRequestId = foreign.body.data!.id;
  });

  after(async () => {
    await app.prisma.auditLog.deleteMany({ where: { resourceId: { in: cleanupAuditResourceIds } } }).catch(() => undefined);
    await app.prisma.enrollmentTokenRequest.deleteMany({ where: { id: { in: cleanupRequestIds } } }).catch(() => undefined);
    await app.prisma.enrollmentToken.deleteMany({ where: { id: { in: cleanupTokenIds } } }).catch(() => undefined);
    await app.prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } }).catch(() => undefined);
    await app.prisma.organization.deleteMany({ where: { id: { in: cleanupOrgIds } } }).catch(() => undefined);
    await app.close();
  });

  it('rejects unauthenticated request access', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/enrollment-token-requests' });
    assert.equal(res.statusCode, 401);
  });

  it('lets operators and viewers submit requests', async () => {
    const operator = await createRequest(operatorToken, {
      label: `Operator request ${runId}`,
      requestNote: 'Need two field laptops enrolled',
      maxUses: 2,
    });
    assert.equal(operator.statusCode, 201);
    assert.equal(operator.body.data?.status, 'PENDING');
    assert.equal(operator.body.data?.maxUses, 2);

    const viewer = await createRequest(viewerToken, {
      label: `Viewer request ${runId}`,
      requestNote: 'Need one kiosk enrolled',
    });
    assert.equal(viewer.statusCode, 201);
    assert.equal(viewer.body.data?.requestedBy?.email, 'viewer@ricoz.local');
  });

  it('validates request payloads', async () => {
    const missingNote = await createRequest(viewerToken, { label: `Invalid ${runId}` });
    assert.equal(missingNote.statusCode, 400);

    const expired = await createRequest(viewerToken, {
      label: `Expired ${runId}`,
      requestNote: 'Expired request',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    assert.equal(expired.statusCode, 400);
  });

  it('scopes request visibility by role and organization', async () => {
    const own = await createRequest(viewerToken, {
      label: `Private ${runId}`,
      requestNote: 'Only the requester should see this',
    });
    assert.equal(own.statusCode, 201);
    const id = own.body.data!.id;

    const operatorView = await app.inject({
      method: 'GET',
      url: `/api/enrollment-token-requests/${id}`,
      headers: headers(operatorToken),
    });
    assert.equal(operatorView.statusCode, 404);

    const foreignView = await app.inject({
      method: 'GET',
      url: `/api/enrollment-token-requests/${foreignRequestId}`,
      headers: headers(orgAdminToken),
    });
    assert.equal(foreignView.statusCode, 404);

    const queue = await app.inject({
      method: 'GET',
      url: '/api/enrollment-token-requests?status=PENDING&limit=100',
      headers: headers(adminToken),
    });
    assert.equal(queue.statusCode, 200);
    const ids = (queue.json() as { data: TokenRequestSummary[] }).data.map((request) => request.id);
    assert.ok(ids.includes(id));
  });

  it('blocks operators and viewers from approving requests', async () => {
    const created = await createRequest(viewerToken, {
      label: `Approval RBAC ${runId}`,
      requestNote: 'Only admins approve',
    });
    assert.equal(created.statusCode, 201);

    for (const token of [viewerToken, operatorToken]) {
      const res = await approveRequest(token, created.body.data!.id);
      assert.equal(res.statusCode, 403);
    }
  });

  it('approves a request and reveals its token exactly once', async () => {
    const created = await createRequest(viewerToken, {
      label: `Reveal ${runId}`,
      requestNote: 'Reveal flow',
      maxUses: 3,
    });
    assert.equal(created.statusCode, 201);
    const id = created.body.data!.id;

    const pendingReveal = await revealToken(viewerToken, id);
    assert.equal(pendingReveal.statusCode, 404);

    const approved = await approveRequest(adminToken, id, 'Approved for field rollout');
    assert.equal(approved.statusCode, 200);
    assert.equal((approved.json() as TokenRequestResponse).data?.status, 'APPROVED');

    const first = await revealToken(viewerToken, id);
    assert.equal(first.statusCode, 200);
    assert.ok(first.body.data?.token.startsWith('rich_'));

    const detail = await app.inject({
      method: 'GET',
      url: `/api/enrollment-token-requests/${id}`,
      headers: headers(viewerToken),
    });
    assert.equal(detail.statusCode, 200);
    const detailBody = detail.json() as TokenRequestResponse;
    assert.equal(detailBody.data?.tokenRevealed, true);
    assert.equal(detailBody.data?.issuedToken?.maxUses, 3);

    const second = await revealToken(adminToken, id);
    assert.equal(second.statusCode, 404);
  });

  it('denies requests with an admin note and blocks later approval', async () => {
    const created = await createRequest(operatorToken, {
      label: `Deny ${runId}`,
      requestNote: 'Will be denied',
    });
    assert.equal(created.statusCode, 201);
    const id = created.body.data!.id;

    const missingNote = await app.inject({
      method: 'POST',
      url: `/api/enrollment-token-requests/${id}/deny`,
      headers: headers(adminToken),
      payload: {},
    });
    assert.equal(missingNote.statusCode, 400);

    const denied = await app.inject({
      method: 'POST',
      url: `/api/enrollment-token-requests/${id}/deny`,
      headers: headers(adminToken),
      payload: { adminNote: 'No devices budgeted' },
    });
    assert.equal(denied.statusCode, 200);
    assert.equal((denied.json() as TokenRequestResponse).data?.status, 'DENIED');

    const lateApproval = await approveRequest(adminToken, id);
    assert.equal(lateApproval.statusCode, 409);
  });

  it('lets requesters cancel only pending requests', async () => {
    const created = await createRequest(operatorToken, {
      label: `Cancel ${runId}`,
      requestNote: 'No longer needed',
    });
    assert.equal(created.statusCode, 201);
    const id = created.body.data!.id;

    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/enrollment-token-requests/${id}/cancel`,
      headers: headers(operatorToken),
      payload: {},
    });
    assert.equal(cancelled.statusCode, 200);
    assert.equal((cancelled.json() as TokenRequestResponse).data?.status, 'CANCELLED');

    const repeat = await app.inject({
      method: 'POST',
      url: `/api/enrollment-token-requests/${id}/cancel`,
      headers: headers(operatorToken),
      payload: {},
    });
    assert.equal(repeat.statusCode, 409);
  });

  it('rejects approval for an expired request', async () => {
    const created = await createRequest(viewerToken, {
      label: `Expiring ${runId}`,
      requestNote: 'Expires before approval',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    assert.equal(created.statusCode, 201);
    const id = created.body.data!.id;
    await app.prisma.enrollmentTokenRequest.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const approved = await approveRequest(adminToken, id);
    assert.equal(approved.statusCode, 410);
  });
});
