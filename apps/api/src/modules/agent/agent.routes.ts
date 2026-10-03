import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateAgent } from '../../middleware/agent-auth.middleware';
import { agentHeartbeatSchema, commandResultSchema, deviceParamsSchema } from '@ricoz/validation';
import { evaluateDeviceCompliance } from '../compliance/compliance.service';
import { markDeviceOnline } from '../../services/device-status.service';
import { createAlertDedup } from '../alerts/alerts.service';

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

const PENDING_COMMAND_TAKE = 20;
const PATCH_INGEST_LIMIT = 1000;

function parsePatchDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCommandParams(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Result payload is free-form agent output; ignore non-JSON values.
  }
  return undefined;
}

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // ─── Agent heartbeat + inventory telemetry ───────────────────────────────────
  app.post('/heartbeat', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Report agent heartbeat with optional hardware/software inventory telemetry',
      tags: ['Agent'],
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          deviceId: { type: 'string', format: 'uuid' },
          agentVersion: { type: 'string' },
          timestamp: { type: 'string' },
          status: { type: 'string', enum: ['ONLINE', 'OFFLINE', 'UNKNOWN'] },
          security: {
            type: 'object',
            properties: {
              firewallEnabled: { type: 'boolean' },
              antivirusEnabled: { type: 'boolean' },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const agentDevice = { id: request.agent!.deviceId, organizationId: request.agent!.organizationId };
      const parsed = agentHeartbeatSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
        });
      }

      const { deviceId, agentVersion, timestamp, status, hardware, software, security, patches } = parsed.data;

      if (deviceId !== agentDevice.id) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Heartbeat deviceId does not match authenticated agent token',
          },
        });
      }

      const now = new Date();
      const heartbeatTime = new Date(timestamp || now.toISOString());

      const [updatedDevice, heartbeat] = await Promise.all([
        app.prisma.device.update({
          where: { id: agentDevice.id },
          data: {
            status,
            lastSeenAt: now,
            agentVersion: agentVersion || undefined,
            ipAddress: request.ip,
            ...(security
              ? {
                  firewallEnabled: security.firewallEnabled ?? undefined,
                  antivirusEnabled: security.antivirusEnabled ?? undefined,
                }
              : {}),
          },
          select: { id: true, deviceName: true, hostname: true, status: true, lastSeenAt: true },
        }),
        app.prisma.deviceHeartbeat.create({
          data: { deviceId: agentDevice.id, agentVersion, timestamp: heartbeatTime, status },
        }),
      ]);

      // A device that reports back is no longer offline: close its alerts.
      if (status === 'ONLINE') {
        await markDeviceOnline(app.prisma, {
          id: agentDevice.id,
          organizationId: agentDevice.organizationId,
        }).catch((error) => {
          app.log.error({ error, context: 'offline_alert_resolution' }, 'Failed to resolve offline alerts');
        });
      }

      if (hardware) {
        await app.prisma.deviceHardware.upsert({
          where: { deviceId: agentDevice.id },
          create: {
            deviceId: agentDevice.id,
            cpu: hardware.cpu,
            cpuCores: hardware.cpuCores,
            ramBytes: BigInt(hardware.ramBytes),
            storageBytes: BigInt(hardware.storageBytes),
            ...(hardware.freeStorageBytes !== undefined
              ? { freeStorageBytes: BigInt(hardware.freeStorageBytes) }
              : {}),
            manufacturer: hardware.manufacturer,
            model: hardware.model,
            serialNumber: hardware.serialNumber,
            biosVersion: hardware.biosVersion,
          },
          update: {
            cpu: hardware.cpu,
            cpuCores: hardware.cpuCores,
            ramBytes: BigInt(hardware.ramBytes),
            storageBytes: BigInt(hardware.storageBytes),
            ...(hardware.freeStorageBytes !== undefined
              ? { freeStorageBytes: BigInt(hardware.freeStorageBytes) }
              : {}),
            manufacturer: hardware.manufacturer,
            model: hardware.model,
            serialNumber: hardware.serialNumber,
            biosVersion: hardware.biosVersion,
          },
        });

        await app.prisma.device.update({
          where: { id: agentDevice.id },
          data: { hostname: hardware.hostname || undefined, os: hardware.os || undefined, osVersion: hardware.osVersion || undefined, architecture: hardware.architecture || undefined },
        });
      }

      if (software) {
        await app.prisma.$transaction(async (tx) => {
          await tx.deviceSoftware.deleteMany({ where: { deviceId: agentDevice.id } });
          if (software.items.length > 0) {
            await tx.deviceSoftware.createMany({
              data: software.items.map((item) => ({
                deviceId: agentDevice.id,
                name: item.name,
                version: item.version,
                publisher: item.publisher,
                installDate: item.installDate ? new Date(item.installDate) : null,
                architecture: item.architecture,
              })),
            });
          }
        });
      }

      if (patches) {
        const reported = patches.items.slice(0, PATCH_INGEST_LIMIT);
        const knownKb = new Set<string>();

        await app.prisma.$transaction(async (tx) => {
          for (const item of reported) {
            const kbNumber = (item.kbNumber ?? '').trim().toUpperCase();
            if (!/^KB\d+$/.test(kbNumber)) {
              continue;
            }
            knownKb.add(kbNumber);
            const title = (item.title ?? '').trim() || kbNumber;

            const patch = await tx.patch.upsert({
              where: {
                organizationId_kbNumber: { organizationId: agentDevice.organizationId, kbNumber },
              },
              create: { organizationId: agentDevice.organizationId, kbNumber, title },
              update: { title },
            });

            const installedAt = parsePatchDate(item.installedAt);
            await tx.devicePatch.upsert({
              where: { deviceId_patchId: { deviceId: agentDevice.id, patchId: patch.id } },
              create: {
                deviceId: agentDevice.id,
                patchId: patch.id,
                status: 'INSTALLED',
                installedAt,
                lastReportedAt: now,
              },
              update: { status: 'INSTALLED', installedAt, lastReportedAt: now },
            });
          }

          // Anything this device previously reported as installed but no longer
          // reports is no longer present (update uninstalled / superseded).
          const patchIds = (
            await tx.patch.findMany({
              where: {
                organizationId: agentDevice.organizationId,
                kbNumber: { in: [...knownKb] },
              },
              select: { id: true },
            })
          ).map((row) => row.id);

          await tx.devicePatch.updateMany({
            where: {
              deviceId: agentDevice.id,
              status: 'INSTALLED',
              ...(patchIds.length > 0 ? { patchId: { notIn: patchIds } } : {}),
            },
            data: { status: 'MISSING', installedAt: null, lastReportedAt: now },
          });
        });
      }

      // Evaluate only after this heartbeat's security, hardware, and patch state
      // have been persisted so policy results reflect the latest telemetry.
      const hasSecurityTelemetry =
        security &&
        (typeof security.firewallEnabled === 'boolean' || typeof security.antivirusEnabled === 'boolean');
      if (hasSecurityTelemetry || hardware || patches) {
        await evaluateDeviceCompliance(
          app.prisma,
          agentDevice.id,
          { firewallEnabled: security?.firewallEnabled, antivirusEnabled: security?.antivirusEnabled },
          agentDevice.organizationId
        ).catch((error) => {
          app.log.error({ error, context: 'compliance_evaluation' }, 'Compliance evaluation failed');
        });
      }

      const pendingCommands = await app.prisma.command.findMany({
        where: { deviceId: agentDevice.id, status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
        take: PENDING_COMMAND_TAKE,
        select: { id: true, type: true, createdAt: true, result: true },
      });

      return reply.send({
        success: true,
        data: {
          device: {
            id: updatedDevice.id,
            deviceName: updatedDevice.deviceName,
            hostname: updatedDevice.hostname,
            status: updatedDevice.status,
            lastSeenAt: toIso(updatedDevice.lastSeenAt),
          },
          heartbeatAt: heartbeat.timestamp.toISOString(),
          pendingCommands: pendingCommands.map((command) => ({
            id: command.id,
            type: command.type,
            createdAt: command.createdAt.toISOString(),
            params: parseCommandParams(command.result),
          })),
        },
      });
    },
  });

  // ─── Agent: report command execution result ──────────────────────────────────
  app.post('/commands/:id/result', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Report the result of an executed command back to the platform',
      tags: ['Agent'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          status: { type: 'string', enum: ['COMPLETED', 'FAILED'] },
          result: { type: 'string' },
          errorMessage: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const agentDevice = { id: request.agent!.deviceId, organizationId: request.agent!.organizationId };
      const params = deviceParamsSchema.safeParse(request.params);
      const body = commandResultSchema.safeParse(request.body);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: params.error.issues[0]?.message ?? 'Invalid command id' },
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message ?? 'Invalid request body' },
        });
      }

      const existing = await app.prisma.command.findFirst({
        where: { id: params.data.id, deviceId: agentDevice.id },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Command not found for this device' },
        });
      }

      // Idempotent: terminal commands are not overwritten.
      if (existing.status === 'COMPLETED' || existing.status === 'FAILED') {
        return reply.send({
          success: true,
          data: {
            id: existing.id,
            type: existing.type,
            status: existing.status,
            requestedBy: existing.requestedBy,
            createdAt: toIso(existing.createdAt),
            startedAt: toIso(existing.startedAt),
            completedAt: toIso(existing.completedAt),
            result: existing.result,
            errorMessage: existing.errorMessage,
          },
        });
      }

      const now = new Date();
      const updated = await app.prisma.$transaction(async (tx) => {
        const command = await tx.command.update({
          where: { id: existing.id },
          data: {
            status: body.data.status,
            startedAt: existing.startedAt ?? now,
            completedAt: now,
            result: body.data.result ?? null,
            errorMessage: body.data.errorMessage ?? null,
          },
        });

        // Software deployments mirror the outcome of the command that drives them.
        if (existing.deploymentId) {
          await tx.deployment.updateMany({
            where: { id: existing.deploymentId },
            data: {
              status: body.data.status,
              completedAt: now,
              errorMessage: body.data.errorMessage ?? null,
            },
          });
        }

        return command;
      });

      // Operational alerting: a failed command surfaces as an alert so the
      // dashboard's failed-actions counter becomes actionable.
      if (updated.status === 'FAILED') {
        await createAlertDedup(app.prisma, {
          organizationId: existing.organizationId,
          deviceId: agentDevice.id,
          type: 'COMMAND_FAILED',
          severity: 'WARNING',
          title: `Command failed: ${updated.type}`,
          message:
            updated.errorMessage ||
            `The agent reported a failure while executing command ${updated.id} (${updated.type}).`,
          dedupKey: `command:${updated.id}`,
        }).catch((error) => {
          app.log.error({ error, context: 'command_failure_alert' }, 'Failed to raise command failure alert');
        });
      }

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          type: updated.type,
          status: updated.status,
          requestedBy: updated.requestedBy,
          createdAt: toIso(updated.createdAt),
          startedAt: toIso(updated.startedAt),
          completedAt: toIso(updated.completedAt),
          result: updated.result,
          errorMessage: updated.errorMessage,
        },
      });
    },
  });

  // ─── Agent: list pending commands (explicit pull) ────────────────────────────
  app.get('/commands/pending', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'List commands queued for the authenticated device agent',
      tags: ['Agent'],
      querystring: {
        type: 'object',
        additionalProperties: true,
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const agentDevice = { id: request.agent!.deviceId, organizationId: request.agent!.organizationId };

      const commands = await app.prisma.command.findMany({
        where: { deviceId: agentDevice.id, status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
        take: PENDING_COMMAND_TAKE,
        select: { id: true, type: true, createdAt: true, result: true },
      });

      return reply.send({
        success: true,
        data: {
          commands: commands.map((command) => ({
            id: command.id,
            type: command.type,
            createdAt: command.createdAt.toISOString(),
            params: parseCommandParams(command.result),
          })),
        },
      });
    },
  });

  // ─── Agent: list effective assigned policies (for SYNC_POLICY) ─────────────
  app.get('/policies', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Return the effective, active policies assigned to the authenticated device (direct + via groups)',
      tags: ['Agent'],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const agentDevice = { id: request.agent!.deviceId, organizationId: request.agent!.organizationId };

      const memberGroups = await app.prisma.deviceGroupMember.findMany({
        where: { deviceId: agentDevice.id },
        select: { groupId: true },
      });
      const groupIds = memberGroups.map((m) => m.groupId);

      const assignments = await app.prisma.policyAssignment.findMany({
        where: {
          policy: { isActive: true },
          OR: [{ deviceId: agentDevice.id }, ...(groupIds.length ? [{ groupId: { in: groupIds } }] : [])],
        },
        orderBy: { priority: 'asc' },
        select: {
          priority: true,
          policy: {
            select: {
              id: true,
              name: true,
              type: true,
              description: true,
              settings: true,
              updatedAt: true,
            },
          },
        },
      });

      // Deduplicate (policy may be assigned directly and via a group).
      const seen = new Set<string>();
      const policies: Array<Record<string, unknown>> = [];
      for (const assignment of assignments) {
        const policy = assignment.policy;
        if (seen.has(policy.id)) continue;
        seen.add(policy.id);
        let settings: unknown = {};
        try {
          settings = JSON.parse(policy.settings ?? '{}');
        } catch {
          settings = {};
        }
        policies.push({
          id: policy.id,
          name: policy.name,
          type: policy.type,
          description: policy.description,
          settings,
          priority: assignment.priority,
          updatedAt: policy.updatedAt.toISOString(),
        });
      }

      const contentHash = JSON.stringify(policies);

      return reply.send({
        success: true,
        data: {
          policies,
          contentHash,
          appliedAt: new Date().toISOString(),
        },
      });
    },
  });
}