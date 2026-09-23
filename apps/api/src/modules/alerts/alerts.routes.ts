import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import {
  alertListQuerySchema,
  alertParamsSchema,
  alertResolveSchema,
  AlertResolveInput,
} from '@ricoz/validation';

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function alertDetails(alert: {
  id: string;
  organizationId: string;
  deviceId: string | null;
  type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  device?: { id: string; deviceName: string; hostname: string; ipAddress: string } | null;
}): Record<string, unknown> {
  return {
    id: alert.id,
    organizationId: alert.organizationId,
    deviceId: alert.deviceId,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    status: alert.status,
    createdAt: toIso(alert.createdAt),
    resolvedAt: toIso(alert.resolvedAt),
    device: alert.device,
  };
}

export async function alertsRoutes(app: FastifyInstance): Promise<void> {
  // ─── List alerts (org-scoped) ──────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'List alerts with optional filters',
      tags: ['Alerts'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string', enum: ['OPEN', 'RESOLVED'] },
          severity: { type: 'string', enum: ['INFO', 'WARNING', 'CRITICAL'] },
          type: { type: 'string' },
          deviceId: { type: 'string', format: 'uuid' },
          search: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const query = alertListQuerySchema.safeParse(request.query);

      if (!query.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: query.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { page, limit, status, severity, type, deviceId, search } = query.data;

      const where: Prisma.AlertWhereInput = {
        ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(type ? { type } : {}),
        ...(deviceId ? { deviceId } : {}),
        ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      };

      const [total, alerts] = await Promise.all([
        app.prisma.alert.count({ where }),
        app.prisma.alert.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { device: { select: { id: true, deviceName: true, hostname: true, ipAddress: true } } },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          items: alerts.map(alertDetails),
          total,
          page,
          limit,
        },
      });
    },
  });

  // ─── Get alert by id ───────────────────────────────────────────────────────
  app.get('/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get a single alert by id',
      tags: ['Alerts'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = alertParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid alert id',
          },
        });
      }

      const alert = await app.prisma.alert.findFirst({
        where:
          jwtUser.role === 'SUPER_ADMIN'
            ? { id: params.data.id }
            : { id: params.data.id, organizationId: jwtUser.organizationId },
        include: { device: { select: { id: true, deviceName: true, hostname: true, ipAddress: true } } },
      });

      if (!alert) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Alert not found' },
        });
      }

      return reply.send({ success: true, data: alertDetails(alert) });
    },
  });

  // ─── Resolve alert ─────────────────────────────────────────────────────────
  app.post('/:id/resolve', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Resolve an open alert (marks it RESOLVED)',
      tags: ['Alerts'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: true,
        properties: { note: { type: 'string', maxLength: 1000 } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = alertParamsSchema.safeParse(request.params);
      const body = alertResolveSchema.safeParse(request.body ?? {});

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid alert id',
          },
        });
      }

      const alert = await app.prisma.alert.findFirst({
        where:
          jwtUser.role === 'SUPER_ADMIN'
            ? { id: params.data.id }
            : { id: params.data.id, organizationId: jwtUser.organizationId },
      });

      if (!alert) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Alert not found' },
        });
      }

      if (alert.status === 'RESOLVED') {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Alert is already resolved' },
        });
      }

      const updated = await app.prisma.alert.update({
        where: { id: alert.id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          message: body.success && (body.data as AlertResolveInput).note
            ? `${alert.message}\n[Resolved by ${jwtUser.email}] ${(body.data as AlertResolveInput).note}`
            : alert.message,
        },
      });

      await app.prisma.auditLog.create({
        data: {
          organizationId: jwtUser.organizationId,
          actorId: jwtUser.sub,
          action: 'ALERT_RESOLVED',
          resource: 'ALERT',
          resourceId: alert.id,
          ipAddress: request.ip,
          metadata: JSON.stringify({ severity: alert.severity, title: alert.title }),
        },
      });

      return reply.send({ success: true, data: alertDetails(updated) });
    },
  });
}