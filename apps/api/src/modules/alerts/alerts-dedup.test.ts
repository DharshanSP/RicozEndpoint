import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { createAlertDedup, createAlertsDedupBatch } from './alerts.service';

describe('Alert de-duplication (batched)', () => {
  let app: FastifyInstance;
  let orgId: string;
  const runId = Date.now();

  before(async () => {
    app = await buildApp();
    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { name: 'Ricoz Demo Organization' },
      select: { id: true },
    });
    orgId = org.id;
  });

  after(async () => {
    await app.prisma.alert.deleteMany({
      where: { type: { in: [`BATCH-${runId}`, `BARE-${runId}`] } },
    });
    await app.close();
  });

  const alertFor = (index: number) => ({
    organizationId: orgId,
    deviceId: null,
    type: `BATCH-${runId}`,
    severity: 'WARNING' as const,
    title: `Batch alert ${index}`,
    message: 'created by alert dedup test',
    dedupKey: `batch-${runId}-${index}`,
  });

  it('creates every new scope exactly once and de-duplicates repeats', async () => {
    const first = await createAlertsDedupBatch(app.prisma, [alertFor(0), alertFor(1), alertFor(2)]);
    assert.equal(first.created, 3);
    assert.equal(first.deduplicated, 0);

    const second = await createAlertsDedupBatch(app.prisma, [alertFor(0), alertFor(1), alertFor(2)]);
    assert.equal(second.created, 0);
    assert.equal(second.deduplicated, 3);

    const stored = await app.prisma.alert.count({
      where: { type: `BATCH-${runId}` },
    });
    assert.equal(stored, 3, 'replays must not stack duplicate rows');
  });

  it('deduplicates a scope without a dedupKey against any existing key', async () => {
    const withKey = {
      organizationId: orgId,
      deviceId: null,
      type: `BARE-${runId}`,
      severity: 'INFO' as const,
      title: 'Keyed alert',
      message: 'has a dedup key',
      dedupKey: `bare-${runId}`,
    };
    const created = await createAlertsDedupBatch(app.prisma, [withKey]);
    assert.equal(created.created, 1);

    // Same org + type, no dedupKey: must match the keyed row, exactly like the
    // single-row helper does (its WHERE clause omits dedupKey when absent).
    const bare = await createAlertsDedupBatch(app.prisma, [
      { ...withKey, dedupKey: undefined, title: 'Bare alert' },
    ]);
    assert.equal(bare.created, 0);
    assert.equal(bare.deduplicated, 1);
  });

  it('agrees with the single-row helper for the same scope', async () => {
    const single = alertFor(9);
    const singleResult = await createAlertDedup(app.prisma, single);
    assert.equal(singleResult.deduplicated, false);

    const batch = await createAlertsDedupBatch(app.prisma, [single]);
    assert.equal(batch.created, 0);
    assert.equal(batch.deduplicated, 1);
  });

  it('handles an empty batch without touching the database', async () => {
    const result = await createAlertsDedupBatch(app.prisma, []);
    assert.deepEqual(result, { created: 0, deduplicated: 0 });
  });
});
