import type { PrismaClient } from '@prisma/client';

export interface CreateAlertCommand {
  organizationId: string;
  deviceId?: string | null;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  dedupKey?: string;
}

/** Statuses that still require attention; used as the de-duplication scope. */
const UNRESOLVED = ['OPEN', 'ACKNOWLEDGED'];

/**
 * Create an alert, de-duplicating against unresolved alerts.
 * Dedup scope: organization + device + type (+ dedupKey when supplied).
 * When an unresolved match exists it is returned untouched so repeated
 * violations (the same policy on the same device, a device that stays offline)
 * never stack duplicates.
 */
export async function createAlertDedup(prisma: PrismaClient, input: CreateAlertCommand) {
  const whereMatch = {
    organizationId: input.organizationId,
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    type: input.type,
    status: { in: UNRESOLVED },
    ...(input.dedupKey ? { dedupKey: input.dedupKey } : {}),
  };

  const existing = await prisma.alert.findFirst({
    where: whereMatch,
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, deduplicated: true };
  }

  const alert = await prisma.alert.create({
    data: {
      organizationId: input.organizationId,
      deviceId: input.deviceId ?? null,
      type: input.type,
      dedupKey: input.dedupKey ?? null,
      severity: input.severity,
      title: input.title,
      message: input.message,
      status: 'OPEN',
      resolvedAt: null,
    },
  });

  return { id: alert.id, deduplicated: false };
}

/**
 * Batched createAlertDedup: one findMany over the union of the scopes plus a
 * single createMany, instead of up to two round trips per input. Each input is
 * de-duplicated with the exact same semantics as the single-row version — a
 * scope that omits deviceId or dedupKey still matches any row on that field.
 * Used by the offline sweeper, where an outage can take hundreds of devices
 * stale at once.
 */
export async function createAlertsDedupBatch(prisma: PrismaClient, inputs: CreateAlertCommand[]) {
  if (inputs.length === 0) return { created: 0, deduplicated: 0 };

  const existing = await prisma.alert.findMany({
    where: {
      OR: inputs.map((input) => ({
        organizationId: input.organizationId,
        ...(input.deviceId ? { deviceId: input.deviceId } : {}),
        type: input.type,
        status: { in: UNRESOLVED },
        ...(input.dedupKey ? { dedupKey: input.dedupKey } : {}),
      })),
    },
    select: { organizationId: true, deviceId: true, type: true, dedupKey: true },
  });

  const alreadyOpen = (input: CreateAlertCommand) =>
    existing.some(
      (row) =>
        row.organizationId === input.organizationId &&
        row.type === input.type &&
        (!input.deviceId || row.deviceId === input.deviceId) &&
        (!input.dedupKey || row.dedupKey === input.dedupKey)
    );

  const toCreate = inputs.filter((input) => !alreadyOpen(input));
  if (toCreate.length > 0) {
    await prisma.alert.createMany({
      data: toCreate.map((input) => ({
        organizationId: input.organizationId,
        deviceId: input.deviceId ?? null,
        type: input.type,
        dedupKey: input.dedupKey ?? null,
        severity: input.severity,
        title: input.title,
        message: input.message,
        status: 'OPEN',
        resolvedAt: null,
      })),
    });
  }

  return { created: toCreate.length, deduplicated: inputs.length - toCreate.length };
}

export interface ResolveAlertsCommand {
  organizationId?: string;
  deviceId?: string;
  type?: string;
  dedupKey?: string;
  resolvedBy: string | null;
  note?: string;
}

/**
 * Auto-resolves every unresolved alert matching the scope. Used when the
 * underlying condition recovers (device back online, policy now satisfied).
 * Returns the number of alerts closed.
 */
export async function resolveAlertsMatching(prisma: PrismaClient, cmd: ResolveAlertsCommand): Promise<number> {
  const where = {
    ...(cmd.organizationId ? { organizationId: cmd.organizationId } : {}),
    ...(cmd.deviceId ? { deviceId: cmd.deviceId } : {}),
    ...(cmd.type ? { type: cmd.type } : {}),
    ...(cmd.dedupKey ? { dedupKey: cmd.dedupKey } : {}),
    status: { in: UNRESOLVED },
  };

  const now = new Date();
  const result = await prisma.alert.updateMany({
    where,
    data: {
      status: 'RESOLVED',
      resolvedAt: now,
      resolvedBy: cmd.resolvedBy,
      resolvedNote: cmd.note ? `Auto-resolved: ${cmd.note}` : 'Auto-resolved: condition recovered',
    },
  });

  return result.count;
}
