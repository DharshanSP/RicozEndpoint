import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import {
  alertListQuerySchema,
  alertParamsSchema,
  alertResolveSchema,
  alertBatchResolveSchema,
  alertCreateSchema,
  AlertResolveInput,
} from '@ricoz/validation';
import { createAlertDedup } from './alerts.service';

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function alertDetails(alert: {
  id: string;
  organizationId: string;
  deviceId: string | null;
  type: string;
  dedupKey?: string | null;
  severity: string;
  title: string;
  message: string;
  status: string;
  createdAt: Date;
  acknowledgedAt?: Date | null;
  acknowledgedBy?: string | null;
  resolvedAt: Date | null;
  resolvedBy?: string | null;
  resolvedNote?: string | null;
  device?: { id: string; deviceName: string; hostname: string; ipAddress: string } | null;
}): Record<string, unknown> {
  return {
    id: alert.id,
    organizationId: alert.organizationId,
    deviceId: alert.deviceId,
    type: alert.type,
    dedupKey: alert.dedupKey ?? null,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    status: alert.status,
    createdAt: toIso(alert.createdAt),
    acknowledgedAt: toIso(alert.acknowledgedAt ?? null),
    acknowledgedBy: alert.acknowledgedBy ?? null,
    resolvedAt: toIso(alert.resolvedAt),
    resolvedBy: alert.resolvedBy ?? null,
    resolvedNote: alert.resolvedNote ?? null,
    device: alert.device,
  };
}

const UNRESOLVED_STATUSES = ['OPEN', 'ACKNOWLEDGED'];

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
          status: { type: 'string', enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] },
          unresolved: { type: 'boolean' },
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

      const { page, limit, status, severity, type, deviceId, search, unresolved } = query.data;

      const where: Prisma.AlertWhereInput = {
        ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
        ...(unresolved ? { status: { in: UNRESOLVED_STATUSES } } : status ? { status } : {}),
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

      const note = body.success ? (body.data as AlertResolveInput).note : undefined;

      const updated = await app.prisma.alert.update({
        where: { id: alert.id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedBy: jwtUser.email,
          resolvedNote: note ?? null,
        },
      });

      await app.prisma.auditLog.create({
        data: {
          organizationId: alert.organizationId,
          actorId: jwtUser.sub,
          action: 'ALERT_RESOLVED',
          resource: 'ALERT',
          resourceId: alert.id,
          ipAddress: request.ip,
          metadata: JSON.stringify({ severity: alert.severity, title: alert.title, note: note ?? null }),
        },
      });

      return reply.send({ success: true, data: alertDetails(updated) });
    },
  });

  // ─── Acknowledge alert (triage without closing) ────────────────────────────
  app.post('/:id/acknowledge', {
    preHandler: [requireMinRole(UserRole.OPERATOR)],
    schema: {
      description: 'Acknowledge an open alert so it stops looking untriaged (stays unresolved)',
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

      if (alert.status === 'ACKNOWLEDGED') {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Alert is already acknowledged' },
        });
      }

      const note = body.success ? (body.data as AlertResolveInput).note : undefined;
      const updated = await app.prisma.alert.update({
        where: { id: alert.id },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: new Date(),
          acknowledgedBy: jwtUser.email,
          ...(note ? { resolvedNote: note } : {}),
        },
      });

      await app.prisma.auditLog.create({
        data: {
          organizationId: alert.organizationId,
          actorId: jwtUser.sub,
          action: 'ALERT_ACKNOWLEDGED',
          resource: 'ALERT',
          resourceId: alert.id,
          ipAddress: request.ip,
          metadata: JSON.stringify({ severity: alert.severity, title: alert.title }),
        },
      });

      return reply.send({ success: true, data: alertDetails(updated) });
    },
  });

  // ─── Batch resolve (bulk triage) ───────────────────────────────────────────
  app.post('/batch-resolve', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Resolve many alerts at once',
      tags: ['Alerts'],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 200 },
          note: { type: 'string', maxLength: 1000 },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const body = alertBatchResolveSchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid batch payload',
          },
        });
      }

      const { ids, note } = body.data;
      const now = new Date();

      const scoped = await app.prisma.alert.findMany({
        where: {
          id: { in: ids },
          ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
        },
        select: { id: true, severity: true, title: true, status: true },
      });

      const openIds = scoped.filter((a) => a.status !== 'RESOLVED').map((a) => a.id);

      if (openIds.length > 0) {
        await app.prisma.alert.updateMany({
          where: { id: { in: openIds } },
          data: {
            status: 'RESOLVED',
            resolvedAt: now,
            resolvedBy: jwtUser.email,
            resolvedNote: note ?? null,
          },
        });

        await app.prisma.auditLog.create({
          data: {
            organizationId: jwtUser.organizationId,
            actorId: jwtUser.sub,
            action: 'ALERTS_BATCH_RESOLVED',
            resource: 'ALERT',
            resourceId: openIds[0] ?? 'alert-batch',
            ipAddress: request.ip,
            metadata: JSON.stringify({ count: openIds.length, note: note ?? null }),
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          requested: ids.length,
          matched: scoped.length,
          resolved: openIds.length,
          notFound: ids.length - scoped.length,
        },
      });
    },
  });

  // ─── Manually raise an alert ───────────────────────────────────────────────
  app.post('/', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Raise a manual alert for a device',
      tags: ['Alerts'],
      body: {
        type: 'object',
        required: ['type', 'severity', 'title', 'message'],
        properties: {
          deviceId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['DEVICE_OFFLINE', 'COMMAND_FAILED', 'COMPLIANCE_VIOLATION', 'SECURITY', 'POLICY', 'INFO'] },
          severity: { type: 'string', enum: ['INFO', 'WARNING', 'CRITICAL'] },
          title: { type: 'string', minLength: 1, maxLength: 255 },
          message: { type: 'string', minLength: 1, maxLength: 2000 },
          dedupKey: { type: 'string', maxLength: 500 },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const body = alertCreateSchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid alert payload',
          },
        });
      }

      const input = body.data;
      const targetOrgId = jwtUser.organizationId;

      if (input.deviceId) {
        const device = await app.prisma.device.findFirst({
          where:
            jwtUser.role === 'SUPER_ADMIN'
              ? { id: input.deviceId }
              : { id: input.deviceId, organizationId: jwtUser.organizationId },
          select: { id: true, organizationId: true },
        });
        if (!device) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Device not found' },
          });
        }
      }

      const created = await createAlertDedup(app.prisma, {
        organizationId: targetOrgId,
        deviceId: input.deviceId ?? null,
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        dedupKey: input.dedupKey,
      });

      await app.prisma.auditLog.create({
        data: {
          organizationId: targetOrgId,
          actorId: jwtUser.sub,
          action: 'ALERT_CREATED',
          resource: 'ALERT',
          resourceId: created.id,
          ipAddress: request.ip,
          metadata: JSON.stringify({ severity: input.severity, title: input.title, deduplicated: created.deduplicated }),
        },
      });

      const alert = await app.prisma.alert.findUnique({
        where: { id: created.id },
        include: { device: { select: { id: true, deviceName: true, hostname: true, ipAddress: true } } },
      });

      return reply.status(created.deduplicated ? 200 : 201).send({
        success: true,
        data: { ...alertDetails(alert!), deduplicated: created.deduplicated },
      });
    },
  });
}