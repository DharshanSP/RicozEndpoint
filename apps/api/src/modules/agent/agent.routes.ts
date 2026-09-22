import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateAgent, AgentDevicePayload } from '../../middleware/agent-auth.middleware';
import { agentHeartbeatSchema, commandResultSchema, deviceParamsSchema } from '@ricoz/validation';

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

const PENDING_COMMAND_TAKE = 20;

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // ─── Agent heartbeat + inventory telemetry ───────────────────────────────────
  app.post('/heartbeat', {
    preHandler: [authenticateAgent(app)],
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
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const agentDevice = request.agentDevice as AgentDevicePayload;
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

      const { deviceId, agentVersion, timestamp, status, hardware, software } = parsed.data;

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
          },
          select: { id: true, deviceName: true, hostname: true, status: true, lastSeenAt: true },
        }),
        app.prisma.deviceHeartbeat.create({
          data: { deviceId: agentDevice.id, agentVersion, timestamp: heartbeatTime, status },
        }),
      ]);

      if (hardware) {
        await app.prisma.deviceHardware.upsert({
          where: { deviceId: agentDevice.id },
          create: {
            deviceId: agentDevice.id,
            cpu: hardware.cpu,
            cpuCores: hardware.cpuCores,
            ramBytes: BigInt(hardware.ramBytes),
            storageBytes: BigInt(hardware.storageBytes),
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

      const pendingCommands = await app.prisma.command.findMany({
        where: { deviceId: agentDevice.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: PENDING_COMMAND_TAKE,
        select: { id: true, type: true, createdAt: true },
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
          })),
        },
      });
    },
  });

  // ─── Agent: report command execution result ──────────────────────────────────
  app.post('/commands/:id/result', {
    preHandler: [authenticateAgent(app)],
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
      const agentDevice = request.agentDevice as AgentDevicePayload;
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
      const updated = await app.prisma.command.update({
        where: { id: existing.id },
        data: {
          status: body.data.status,
          startedAt: existing.startedAt ?? now,
          completedAt: now,
          result: body.data.result ?? null,
          errorMessage: body.data.errorMessage ?? null,
        },
      });

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
    preHandler: [authenticateAgent(app)],
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
      const agentDevice = request.agentDevice as AgentDevicePayload;

      const commands = await app.prisma.command.findMany({
        where: { deviceId: agentDevice.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: PENDING_COMMAND_TAKE,
        select: { id: true, type: true, createdAt: true },
      });

      return reply.send({
        success: true,
        data: {
          commands: commands.map((command) => ({
            id: command.id,
            type: command.type,
            createdAt: command.createdAt.toISOString(),
          })),
        },
      });
    },
  });
}