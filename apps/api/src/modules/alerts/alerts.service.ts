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

/**
 * Create an alert, de-duplicating against existing OPEN alerts.
 * Dedup scope: same organization + device +(optional) type++ dedupKey.
 * If an OPEN alert already matches, it is touched (updatedAt preserved) and
 * the existing row is returned instead of creating a duplicate.
 */
export async function createAlertDedup(prisma: PrismaClient, input: CreateAlertCommand) {
  const whereMatch = {
    organizationId: input.organizationId,
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    status: 'OPEN',
  };

  const existing = await prisma.alert.findFirst({
    where: {
      ...whereMatch,
      ...(input.dedupKey
        ? { OR: [{ type: input.type }, { message: input.dedupKey }] }
        : { type: input.type }),
    },
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
      severity: input.severity,
      title: input.title,
      message: input.message,
      status: 'OPEN',
      resolvedAt: null,
    },
  });

  return { id: alert.id, deduplicated: false };
}