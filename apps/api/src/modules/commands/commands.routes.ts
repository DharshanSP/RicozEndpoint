import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import {
  createCommandSchema,
  commandParamsSchema,
  commandListQuerySchema,
  CreateCommandInput,
} from '@ricoz/validation';

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function commandDetails(command: {
  id: string;
  deviceId: string;
  type: string;
  status: string;
  requestedBy: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  result: string | null;
  errorMessage: string | null;
}): Record<string, unknown> {
  return {
    id: command.id,
    deviceId: command.deviceId,
    type: command.type,
    status: command.status,
    requestedBy: command.requestedBy,
    createdAt: toIso(command.createdAt),
    startedAt: toIso(command.startedAt),
    completedAt: toIso(command.completedAt),
    result: command.result,
    errorMessage: command.errorMessage,
  };
}

export async function commandsRoutes(app: FastifyInstance): Promise<void> {
  // ─── List commands (org-scoped) ────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'List commands issued across the organization',
      tags: ['Commands'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          deviceId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['REFRESH_INVENTORY', 'SYNC_POLICY', 'LOCK_DEVICE', 'RESTART_DEVICE', 'SHUTDOWN_DEVICE'] },
          status: { type: 'string', enum: ['QUEUED', 'SENT', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const query = commandListQuerySchema.safeParse(request.query);

      if (!query.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: query.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { page, limit, deviceId, type, status } = query.data;

      const where: Prisma.CommandWhereInput = {
        ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
        ...(deviceId ? { deviceId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      };

      const [total, commands] = await Promise.all([
        app.prisma.command.count({ where }),
        app.prisma.command.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { device: { select: { id: true, deviceName: true, hostname: true } } },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          items: commands.map((command) => ({
            ...commandDetails(command),
            device: command.device,
          })),
          total,
          page,
          limit,
        },
      });
    },
  });

  // ─── Create command (destructive types require confirmed: true) ────────────
  app.post('/', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Issue a command to a device. Destructive commands (LOCK/RESTART/SHUTDOWN) require confirmed: true',
      tags: ['Commands'],
      body: {
        type: 'object',
        required: ['deviceId', 'type'],
        properties: {
          deviceId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['REFRESH_INVENTORY', 'SYNC_POLICY', 'LOCK_DEVICE', 'RESTART_DEVICE', 'SHUTDOWN_DEVICE'] },
          confirmed: { type: 'boolean', default: false },
          params: { type: 'object', additionalProperties: true },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const body = createCommandSchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid command payload',
            details: body.error.issues,
          },
        });
      }

      const input = body.data as CreateCommandInput;

      const device = await app.prisma.device.findFirst({
        where:
          jwtUser.role === 'SUPER_ADMIN'
            ? { id: input.deviceId }
            : { id: input.deviceId, organizationId: jwtUser.organizationId },
        select: { id: true, deviceName: true, status: true },
      });

      if (!device) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found in your organization' },
        });
      }

      const command = await app.prisma.command.create({
        data: {
          organizationId: jwtUser.organizationId,
          deviceId: device.id,
          type: input.type,
          status: 'QUEUED',
          requestedBy: jwtUser.sub,
          result: input.params ? JSON.stringify(input.params) : undefined,
        },
      });

      await app.prisma.auditLog.create({
        data: {
          organizationId: jwtUser.organizationId,
          actorId: jwtUser.sub,
          action: 'COMMAND_CREATED',
          resource: 'COMMAND',
          resourceId: command.id,
          ipAddress: request.ip,
          metadata: JSON.stringify({ type: input.type, deviceId: device.id, deviceName: device.deviceName }),
        },
      });

      return reply.status(201).send({ success: true, data: commandDetails(command) });
    },
  });

  // ─── Get command by id ─────────────────────────────────────────────────────
  app.get('/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get a single command by id',
      tags: ['Commands'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = commandParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid command id',
          },
        });
      }

      const command = await app.prisma.command.findFirst({
        where:
          jwtUser.role === 'SUPER_ADMIN'
            ? { id: params.data.id }
            : { id: params.data.id, organizationId: jwtUser.organizationId },
      });

      if (!command) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Command not found' },
        });
      }

      return reply.send({ success: true, data: commandDetails(command) });
    },
  });
}