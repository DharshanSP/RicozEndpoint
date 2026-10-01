import type { PrismaClient } from '@prisma/client';
import { createAlertDedup, resolveAlertsMatching } from '../modules/alerts/alerts.service';

const DEFAULT_OFFLINE_TIMEOUT_MINUTES = 15;
const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 60;

interface OrgSettings {
  offlineTimeoutMinutes?: number;
  agentHeartbeatIntervalSeconds?: number;
}

function parseSettings(raw: unknown): OrgSettings {
  if (typeof raw !== 'object' || raw === null) return {};
  return raw as OrgSettings;
}

/**
 * Offline threshold for an organization: its configured offline timeout, never
 * shorter than two heartbeat intervals so a single missed beat is tolerated.
 */
function offlineThreshold(raw: unknown): Date {
  const settings = parseSettings(raw);
  const minutes = settings.offlineTimeoutMinutes ?? DEFAULT_OFFLINE_TIMEOUT_MINUTES;
  const heartbeatSeconds = settings.agentHeartbeatIntervalSeconds ?? DEFAULT_HEARTBEAT_INTERVAL_SECONDS;
  const effectiveMinutes = Math.max(minutes, (heartbeatSeconds * 2) / 60);
  return new Date(Date.now() - effectiveMinutes * 60_000);
}

/**
 * Marks every ONLINE device that has not reported within its organization's
 * offline timeout as OFFLINE and raises a de-duplicated DEVICE_OFFLINE alert.
 * Runs on a background timer (see server.ts) so device status no longer depends
 * on someone opening the device list.
 */
export async function sweepOfflineDevices(prisma: PrismaClient): Promise<number> {
  const organizations = await prisma.organization.findMany({
    select: { id: true, settingsJson: true },
  });

  let markedOffline = 0;

  for (const organization of organizations) {
    const cutoff = offlineThreshold(organization.settingsJson);

    const stale = await prisma.device.findMany({
      where: { organizationId: organization.id, status: 'ONLINE', lastSeenAt: { lt: cutoff } },
      select: { id: true, hostname: true, deviceName: true, lastSeenAt: true },
    });

    if (stale.length === 0) continue;

    await prisma.device.updateMany({
      where: { id: { in: stale.map((device) => device.id) } },
      data: { status: 'OFFLINE' },
    });

    const settings = parseSettings(organization.settingsJson);
    const timeoutMinutes = settings.offlineTimeoutMinutes ?? DEFAULT_OFFLINE_TIMEOUT_MINUTES;

    for (const device of stale) {
      await createAlertDedup(prisma, {
        organizationId: organization.id,
        deviceId: device.id,
        type: 'DEVICE_OFFLINE',
        severity: 'WARNING',
        title: `Device offline: ${device.hostname}`,
        message: `No agent heartbeat received in the last ${timeoutMinutes} minute(s). Last seen ${
          device.lastSeenAt ? device.lastSeenAt.toISOString() : 'never'
        }.`,
        dedupKey: `offline:${device.id}`,
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        actorId: null,
        action: 'DEVICES_MARKED_OFFLINE',
        resource: 'DEVICE',
        resourceId: stale[0]?.id ?? 'device-batch',
        ipAddress: 'scheduler',
        metadata: JSON.stringify({ count: stale.length, timeoutMinutes }),
      },
    });

    markedOffline += stale.length;
  }

  return markedOffline;
}

/**
 * Called whenever an agent reports in: restores ONLINE status and closes any
 * open DEVICE_OFFLINE alert for the device.
 */
export async function markDeviceOnline(
  prisma: PrismaClient,
  device: { id: string; organizationId: string }
): Promise<void> {
  await resolveAlertsMatching(prisma, {
    organizationId: device.organizationId,
    deviceId: device.id,
    type: 'DEVICE_OFFLINE',
    resolvedBy: null,
    note: 'Device reported a heartbeat',
  });
}

/** Starts the background sweeper. The timer is unref'd so it never keeps the process alive. */
export function startOfflineSweeper(
  prisma: PrismaClient,
  log?: { info: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void },
  intervalMs = 60_000
): NodeJS.Timeout {
  const run = async () => {
    try {
      const marked = await sweepOfflineDevices(prisma);
      if (marked > 0) {
        log?.info({ markedOffline: marked }, 'Offline sweep marked devices offline');
      }
    } catch (error) {
      log?.error({ error }, 'Offline sweep failed');
    }
  };

  void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return timer;
}
