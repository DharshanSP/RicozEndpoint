import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import { auditLogListQuerySchema, auditLogParamsSchema } from '@ricoz/validation';

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function auditLogsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'List organizational audit log entries with filters',
      tags: ['Audit Logs'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          action: { type: 'string' },
          resource: { type: 'string' },
          actorId: { type: 'string', format: 'uuid' },
          resourceId: { type: 'string' },
          deviceId: { type: 'string', format: 'uuid' },
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const query = auditLogListQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: query.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { page, limit, search, action, resource, actorId, from, to } = query.data;
      const { resourceId, deviceId } = request.query as { resourceId?: string; deviceId?: string };
      const resourceIdFilter = resourceId ?? deviceId;

      const where: Prisma.AuditLogWhereInput = {
        ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
        ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
        ...(resource ? { resource: { contains: resource, mode: 'insensitive' } } : {}),
        ...(actorId ? { actorId } : {}),
        ...(resourceIdFilter ? { resourceId: { contains: resourceIdFilter, mode: 'insensitive' } } : {}),
        ...(from || to
          ? {
              timestamp: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { action: { contains: search, mode: 'insensitive' } },
                { resource: { contains: search, mode: 'insensitive' } },
                { resourceId: { contains: search, mode: 'insensitive' } },
                { actor: { email: { contains: search, mode: 'insensitive' } } },
                { actor: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };

      const [total, logs] = await Promise.all([
        app.prisma.auditLog.count({ where }),
        app.prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            actor: { select: { id: true, email: true, name: true } },
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          items: logs.map((log) => ({
            id: log.id,
            organizationId: log.organizationId,
            actorId: log.actorId,
            actor: log.actor,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            timestamp: log.timestamp.toISOString(),
            ipAddress: log.ipAddress,
            metadata: parseMetadata(log.metadata),
          })),
          total,
          page,
          limit,
        },
      });
    },
  });

  // ─── Get a single audit record (detail view / export) ──────────────────────
  app.get('/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get a single audit log entry by id',
      tags: ['Audit Logs'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = auditLogParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid audit log id',
          },
        });
      }

      const log = await app.prisma.auditLog.findFirst({
        where: {
          id: params.data.id,
          ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
        },
        include: {
          actor: { select: { id: true, email: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      });

      if (!log) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Audit log not found' },
        });
      }

      return reply.send({
        success: true,
        data: {
          id: log.id,
          organizationId: log.organizationId,
          organization: log.organization,
          actorId: log.actorId,
          actor: log.actor,
          action: log.action,
          resource: log.resource,
          resourceId: log.resourceId,
          timestamp: log.timestamp.toISOString(),
          ipAddress: log.ipAddress,
          metadata: parseMetadata(log.metadata),
        },
      });
    },
  });
}