import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../server';
import { purgeOldAuditLogs, purgeResolvedAlerts } from './device-status.service';

/**
 * alertRetentionDays enforcement: only RESOLVED alerts older than the window
 * are purged. Unresolved alerts are operational data and are never touched.
 */
describe('Alert retention purge (purgeResolvedAlerts)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let orgId: string;
  const runId = Date.now();
  const DAY = 24 * 60 * 60_000;

  before(async () => {
    app = await buildApp();
    prisma = new PrismaClient();

    const org = await prisma.organization.create({
      data: {
        name: `Retention-Test-${runId}`,
        settingsJson: { alertRetentionDays: 7 },
      },
    });
    orgId = org.id;

    const old = new Date(Date.now() - 30 * DAY);
    await prisma.alert.createMany({
      data: [
        {
          organizationId: orgId,
          type: 'INFO',
          severity: 'INFO',
          title: `retention old resolved ${runId}`,
          message: 'must be purged',
          status: 'RESOLVED',
          resolvedAt: old,
          dedupKey: `ret-old-${runId}`,
        },
        {
          organizationId: orgId,
          type: 'INFO',
          severity: 'INFO',
          title: `retention fresh resolved ${runId}`,
          message: 'must survive',
          status: 'RESOLVED',
          resolvedAt: new Date(),
          dedupKey: `ret-fresh-${runId}`,
        },
        {
          organizationId: orgId,
          type: 'INFO',
          severity: 'INFO',
          title: `retention old open ${runId}`,
          message: 'operational, must survive',
          status: 'OPEN',
          createdAt: old,
          dedupKey: `ret-open-${runId}`,
        },
      ],
    });
  });

  after(async () => {
    await prisma.alert.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    await prisma.$disconnect();
    await app.close();
  });

  it('purges only resolved alerts older than the retention window', async () => {
    const purged = await purgeResolvedAlerts(prisma, orgId, 7);
    assert.equal(purged, 1);

    const remaining = await prisma.alert.findMany({
      where: { organizationId: orgId },
      select: { title: true },
    });
    const titles = remaining.map((a) => a.title);
    assert.equal(remaining.length, 2);
    assert.ok(titles.some((t) => t.includes('fresh resolved')));
    assert.ok(titles.some((t) => t.includes('old open')));
  });

  it('honors a custom per-organization window', async () => {
    const extra = await prisma.alert.create({
      data: {
        organizationId: orgId,
        type: 'INFO',
        severity: 'INFO',
        title: `retention mid resolved ${runId}`,
        message: 'inside the wide window',
        status: 'RESOLVED',
        resolvedAt: new Date(Date.now() - 10 * DAY),
        dedupKey: `ret-mid-${runId}`,
      },
    });

    assert.equal(await purgeResolvedAlerts(prisma, orgId, 30), 0);
    assert.equal(await purgeResolvedAlerts(prisma, orgId, 7), 1);
    await prisma.alert.delete({ where: { id: extra.id } }).catch(() => undefined);
  });

  it('purges audit rows older than the retention window', async () => {
    await prisma.auditLog.createMany({
      data: [
        {
          organizationId: orgId,
          action: 'TEST_OLD',
          resource: 'TEST',
          resourceId: `old-${runId}`,
          timestamp: new Date(Date.now() - 400 * DAY),
        },
        {
          organizationId: orgId,
          action: 'TEST_FRESH',
          resource: 'TEST',
          resourceId: `fresh-${runId}`,
          timestamp: new Date(),
        },
      ],
    });

    assert.equal(await purgeOldAuditLogs(prisma, orgId, 365), 1);

    const remaining = await prisma.auditLog.findMany({
      where: { organizationId: orgId, resource: 'TEST' },
      select: { action: true },
    });
    assert.deepEqual(
      remaining.map((r) => r.action),
      ['TEST_FRESH']
    );
    await prisma.auditLog.deleteMany({ where: { organizationId: orgId, resource: 'TEST' } });
  });
});
