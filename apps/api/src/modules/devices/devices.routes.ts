import type { FastifyInstance } from 'fastify';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import { z } from 'zod';
import { verifyPassword } from '../../utils/password';

const deviceListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  complianceStatus: z.enum(['COMPLIANT', 'NON_COMPLIANT', 'UNTESTED']).optional(),
  os: z.string().optional(),
  manufacturer: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.preprocess(
    (v) => { const n = Number(v); return Number.isFinite(n) ? n : v; },
    z.number().int().positive()
  ).optional().default(1),
  limit: z.preprocess(
    (v) => { const n = Number(v); return Number.isFinite(n) ? n : v; },
    z.number().int().min(1).max(500)
  ).optional().default(20),
});

type ComplianceBucket = 'COMPLIANT' | 'NON_COMPLIANT' | 'UNTESTED';

/**
 * Derives each device's compliance bucket from its current results:
 * any NON_COMPLIANT result wins, otherwise a device with results is COMPLIANT,
 * and a device that has never been evaluated is UNTESTED.
 */
function buildComplianceStatusMap(
  rows: Array<{ deviceId: string; status: string }>
): Map<string, ComplianceBucket> {
  const map = new Map<string, { total: number; nonCompliant: number }>();
  for (const row of rows) {
    const entry = map.get(row.deviceId) ?? { total: 0, nonCompliant: 0 };
    entry.total += 1;
    if (row.status === 'NON_COMPLIANT') entry.nonCompliant += 1;
    map.set(row.deviceId, entry);
  }

  const result = new Map<string, ComplianceBucket>();
  for (const [deviceId, entry] of map) {
    result.set(
      deviceId,
      entry.nonCompliant > 0 ? 'NON_COMPLIANT' : entry.total > 0 ? 'COMPLIANT' : 'UNTESTED'
    );
  }
  return result;
}

function complianceWhere(bucket: ComplianceBucket): Record<string, unknown> {
  if (bucket === 'NON_COMPLIANT') {
    return { complianceResults: { some: { status: 'NON_COMPLIANT' } } };
  }
  if (bucket === 'UNTESTED') {
    return { complianceResults: { none: {} } };
  }
  return {
    AND: [{ complianceResults: { some: {} } }, { complianceResults: { none: { status: 'NON_COMPLIANT' } } }],
  };
}

export async function devicesRoutes(app: FastifyInstance): Promise<void> {
  // Note: enrollment lives on POST /api/enroll (enrollment module), which
  // validates the token against the database. The former public
  // POST /api/devices/enroll accepted any `RICOZ-ENROLL-*` string and wrote
  // into the first organization, so it was removed.

  // List organization devices (Dashboard Endpoint)
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'List enrolled devices in current organization',
      tags: ['Devices'],
      querystring: {
        type: 'object',
        additionalProperties: true,
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;

      const parsed = deviceListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const {
        search,
        status,
        complianceStatus,
        os,
        manufacturer,
        sortBy,
        sortOrder = 'asc',
        page = 1,
        limit = 20,
      } = parsed.data;

      // `NON_COMPLIANT` is a compliance bucket rather than a device status, so
      // it is translated into a compliance filter instead of a status filter.
      const deviceStatus = status && status !== 'NON_COMPLIANT' ? status : undefined;
      const bucket: ComplianceBucket | undefined =
        complianceStatus ?? (status === 'NON_COMPLIANT' ? 'NON_COMPLIANT' : undefined);

      const whereClause: Record<string, unknown> = {
        ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
        ...(deviceStatus ? { status: deviceStatus } : {}),
        ...(bucket ? complianceWhere(bucket) : {}),
        ...(os ? { os: { contains: os } } : {}),
        ...(manufacturer ? { manufacturer: { contains: manufacturer, mode: 'insensitive' } } : {}),
        ...(search
          ? {
              OR: [
                { hostname: { contains: search } },
                { deviceName: { contains: search } },
                { serialNumber: { contains: search } },
                { ipAddress: { contains: search } },
                { os: { contains: search } },
              ],
            }
          : {}),
      };

      const orderByClause: Record<string, 'asc' | 'desc'> = {};
      if (sortBy && ['deviceName', 'hostname', 'status', 'os', 'serialNumber', 'lastSeenAt', 'createdAt'].includes(sortBy)) {
        orderByClause[sortBy] = sortOrder;
      } else {
        orderByClause.createdAt = sortOrder;
      }

      const [devices, total] = await Promise.all([
        app.prisma.device.findMany({
          where: whereClause,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: orderByClause,
          include: {
            hardware: true,
          },
        }),
        app.prisma.device.count({ where: whereClause }),
      ]);

      const pageIds = devices.map((device) => device.id);
      const resultRows =
        pageIds.length === 0
          ? []
          : await app.prisma.complianceResult.groupBy({
              by: ['deviceId', 'status'],
              where: { deviceId: { in: pageIds } },
              _count: { _all: true },
            });
      const complianceMap = buildComplianceStatusMap(resultRows);

      const formattedDevices = devices.map((d) => ({
        id: d.id,
        organizationId: d.organizationId,
        deviceName: d.deviceName,
        hostname: d.hostname,
        serialNumber: d.serialNumber,
        manufacturer: d.manufacturer,
        model: d.model,
        os: d.os,
        osVersion: d.osVersion,
        architecture: d.architecture,
        ipAddress: d.ipAddress,
        agentVersion: d.agentVersion,
        status: d.status,
        complianceStatus: complianceMap.get(d.id) ?? 'UNTESTED',
        lastSeenAt: d.lastSeenAt,
        registeredAt: d.registeredAt,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        hardware: d.hardware,
      }));

      return reply.send({
        success: true,
        data: formattedDevices,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    },
  });

  // Get single device detail
  app.get('/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get device details including hardware specs and software inventory',
      tags: ['Devices'],
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const device = await app.prisma.device.findUnique({
        where: { id },
        include: {
          hardware: true,
          software: { take: 50, orderBy: { name: 'asc' } },
          heartbeats: { take: 10, orderBy: { timestamp: 'desc' } },
          commands: { take: 10, orderBy: { createdAt: 'desc' } },
          policies: {
            include: {
              policy: true,
            },
          },
          complianceResults: { take: 20, orderBy: { evaluatedAt: 'desc' } },
        },
      });

      if (!device) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      if (jwtUser.role !== 'SUPER_ADMIN' && device.organizationId !== jwtUser.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      // Real compliance bucket from stored evaluation results.
      const complianceRows = await app.prisma.complianceResult.groupBy({
        by: ['status'],
        where: { deviceId: device.id },
        _count: { _all: true },
      });
      const totalResults = complianceRows.reduce((sum, row) => sum + row._count._all, 0);
      const nonCompliantResults =
        complianceRows.find((row) => row.status === 'NON_COMPLIANT')?._count._all ?? 0;
      const complianceStatus: ComplianceBucket =
        totalResults === 0 ? 'UNTESTED' : nonCompliantResults > 0 ? 'NON_COMPLIANT' : 'COMPLIANT';

      // Fetch audit logs as activity
      const auditLogs = await app.prisma.auditLog.findMany({
        where: {
          organizationId: device.organizationId,
          resourceId: device.id,
        },
        take: 20,
        orderBy: { timestamp: 'desc' },
        include: { actor: { select: { id: true, email: true, name: true } } },
      });

      const activity = [
        ...auditLogs.map((log) => ({
          id: log.id,
          type: log.action,
          category: 'AUDIT',
          timestamp: log.timestamp.toISOString(),
          description: `Action ${log.action} performed on device`,
          actor: log.actor,
        })),
        ...device.heartbeats.map((hb) => ({
          id: hb.id,
          type: 'HEARTBEAT',
          category: 'HEARTBEAT',
          timestamp: hb.timestamp.toISOString(),
          status: hb.status,
          description: `Device reported status ${hb.status}`,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const hardwareFormatted = device.hardware
        ? {
            ...device.hardware,
            ramBytes: String(device.hardware.ramBytes),
            storageBytes: String(device.hardware.storageBytes),
            freeStorageBytes: device.hardware.freeStorageBytes?.toString() ?? null,
          }
        : null;

      return reply.send({
        success: true,
        data: {
          overview: {
            id: device.id,
            organizationId: device.organizationId,
            deviceName: device.deviceName,
            hostname: device.hostname,
            serialNumber: device.serialNumber,
            manufacturer: device.manufacturer,
            model: device.model,
            os: device.os,
            osVersion: device.osVersion,
            architecture: device.architecture,
            ipAddress: device.ipAddress,
            agentVersion: device.agentVersion,
            status: device.status,
            complianceStatus,
            lastSeenAt: device.lastSeenAt,
            registeredAt: device.registeredAt,
            createdAt: device.createdAt,
            updatedAt: device.updatedAt,
          },
          hardware: hardwareFormatted,
          software: device.software,
          policies: device.policies.map((p) => ({
            id: p.id,
            policy: p.policy,
            status: 'APPLIED',
            priority: p.priority,
          })),
          compliance: device.complianceResults,
          commands: device.commands,
          activity,
        },
      });
    },
  });

  // Hardware inventory endpoint
  app.get('/:id/hardware', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get hardware inventory for a specific device',
      tags: ['Devices'],
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const device = await app.prisma.device.findUnique({
        where: { id },
        include: { hardware: true },
      });

      if (!device || (jwtUser.role !== 'SUPER_ADMIN' && device.organizationId !== jwtUser.organizationId)) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      if (!device.hardware) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Hardware inventory not found for device' },
        });
      }

      return reply.send({
        success: true,
        data: {
          ...device.hardware,
          ramBytes: String(device.hardware.ramBytes),
          storageBytes: String(device.hardware.storageBytes),
          freeStorageBytes: device.hardware.freeStorageBytes?.toString() ?? null,
        },
      });
    },
  });

  // Software inventory endpoint
  app.get('/:id/software', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get software inventory for a specific device',
      tags: ['Devices'],
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const device = await app.prisma.device.findUnique({
        where: { id },
        include: { software: true },
      });

      if (!device || (jwtUser.role !== 'SUPER_ADMIN' && device.organizationId !== jwtUser.organizationId)) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      return reply.send({
        success: true,
        data: device.software,
      });
    },
  });

  // Activity stream endpoint
  app.get('/:id/activity', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get paginated activity history for a specific device (audit, heartbeats, commands, alerts, compliance, patches)',
      tags: ['Devices'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          type: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { page = 1, limit = 20, type } = (request.query ?? {}) as {
        page?: number;
        limit?: number;
        type?: string;
      };
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

      const device = await app.prisma.device.findUnique({
        where: { id },
        include: { heartbeats: { take: 10, orderBy: { timestamp: 'desc' } } },
      });

      if (!device || (jwtUser.role !== 'SUPER_ADMIN' && device.organizationId !== jwtUser.organizationId)) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      const typeFilter = (type ?? '').toUpperCase();
      const includeAudit = !typeFilter || ['ALL', 'AUDIT', 'DEVICE', 'USER'].includes(typeFilter) || typeFilter.includes('DEVICE_') || typeFilter.includes('COMMAND') || typeFilter.includes('PATCH') || typeFilter.includes('POLICY') || typeFilter.includes('LOGIN') || typeFilter.includes('ENROLL');
      const includeHeartbeat = !typeFilter || ['ALL', 'HEARTBEAT', 'ONLINE', 'OFFLINE'].includes(typeFilter);
      const includeCommand = !typeFilter || ['ALL', 'COMMAND'].includes(typeFilter) || typeFilter.includes('COMMAND');
      const includeAlert = !typeFilter || ['ALL', 'ALERT'].includes(typeFilter);
      const includeCompliance = !typeFilter || ['ALL', 'COMPLIANCE'].includes(typeFilter);
      const includePatch = !typeFilter || ['ALL', 'PATCH'].includes(typeFilter);

      const [auditLogs, commands, alerts, compliance, devicePatches] = await Promise.all([
        includeAudit
          ? app.prisma.auditLog.findMany({
              where: {
                organizationId: device.organizationId,
                OR: [{ resourceId: device.id }, { resource: 'DEVICE', resourceId: device.id }],
                ...(typeFilter && typeFilter !== 'ALL' && !['COMMAND', 'ALERT', 'COMPLIANCE', 'PATCH', 'HEARTBEAT'].includes(typeFilter)
                  ? { action: { contains: typeFilter, mode: 'insensitive' } }
                  : {}),
              },
              take: 100,
              orderBy: { timestamp: 'desc' },
              include: { actor: { select: { id: true, email: true, name: true } } },
            })
          : Promise.resolve([]),
        includeCommand
          ? app.prisma.command.findMany({
              where: { deviceId: device.id },
              take: 50,
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),
        includeAlert
          ? app.prisma.alert.findMany({
              where: { deviceId: device.id },
              take: 50,
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),
        includeCompliance
          ? app.prisma.complianceResult.findMany({
              where: { deviceId: device.id },
              take: 50,
              orderBy: { evaluatedAt: 'desc' },
            })
          : Promise.resolve([]),
        includePatch
          ? app.prisma.devicePatch.findMany({
              where: { deviceId: device.id },
              take: 50,
              orderBy: { updatedAt: 'desc' },
              include: { patch: { select: { kbNumber: true, title: true, severity: true } } },
            })
          : Promise.resolve([]),
      ]);

      const describeAudit = (action: string, metadata: string | null): string => {
        try {
          const meta = metadata ? (JSON.parse(metadata) as Record<string, unknown>) : null;
          if (action === 'DEVICE_ENROLLED') return `Enrolled${meta?.hostname ? ` as ${meta.hostname}` : ''}`;
          if (action === 'DEVICE_UPDATED') {
            const changed = (meta?.changed as string[] | undefined)?.join(', ');
            return changed ? `Updated: ${changed}` : 'Device details updated';
          }
          if (action === 'COMMAND_CREATED') return `Command issued: ${String(meta?.type ?? 'command')}`;
          if (action === 'PATCH_DEPLOYED') return `Patch deployment queued (${String(meta?.queued ?? 0)} devices)`;
          if (action.startsWith('LOGIN')) return action === 'LOGIN_SUCCESS' ? 'User login' : 'Failed login attempt';
        } catch {
          // fall through to generic description
        }
        return `Action ${action} performed on device`;
      };

      const activity = [
        ...auditLogs.map((log) => ({
          id: log.id,
          type: log.action,
          category: 'AUDIT' as const,
          timestamp: log.timestamp.toISOString(),
          description: describeAudit(log.action, log.metadata),
          actor: log.actor,
          metadata: (() => {
            try {
              return log.metadata ? JSON.parse(log.metadata) : null;
            } catch {
              return null;
            }
          })(),
        })),
        ...device.heartbeats.filter(() => includeHeartbeat).map((hb) => ({
          id: hb.id,
          type: 'HEARTBEAT',
          category: 'HEARTBEAT' as const,
          timestamp: hb.timestamp.toISOString(),
          status: hb.status,
          description: `Device reported status ${hb.status}`,
        })),
        ...commands.map((cmd) => ({
          id: cmd.id,
          type: `COMMAND_${cmd.status}`,
          category: 'COMMAND' as const,
          timestamp: (cmd.completedAt ?? cmd.startedAt ?? cmd.createdAt).toISOString(),
          status: cmd.status,
          description: `Command ${cmd.type} ${cmd.status.toLowerCase()}`,
        })),
        ...alerts.map((alert) => ({
          id: alert.id,
          type: `ALERT_${alert.status}`,
          category: 'ALERT' as const,
          timestamp: alert.createdAt.toISOString(),
          status: alert.status,
          severity: alert.severity,
          description: alert.title || `Alert: ${alert.type}`,
        })),
        ...compliance.map((result) => ({
          id: result.id,
          type: `COMPLIANCE_${result.status}`,
          category: 'COMPLIANCE' as const,
          timestamp: result.evaluatedAt.toISOString(),
          status: result.status,
          description: result.reason || `Compliance evaluation: ${result.status.toLowerCase()}`,
        })),
        ...devicePatches.map((row) => ({
          id: row.id,
          type: `PATCH_${row.status}`,
          category: 'PATCH' as const,
          timestamp: (row.installedAt ?? row.lastReportedAt).toISOString(),
          status: row.status,
          description: `${row.patch.kbNumber} ${row.status.toLowerCase()}: ${row.patch.title}`,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = activity.length;
      const paged = activity.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      return reply.send({
        success: true,
        data: paged,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
        },
      });
    },
  });

  // Update editable device attributes (rename / correct inventory metadata)
  app.patch('/:id', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Update device display name, hostname or hardware metadata',
      tags: ['Devices'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          deviceName: { type: 'string', minLength: 1, maxLength: 255 },
          hostname: { type: 'string', minLength: 1, maxLength: 255 },
          ipAddress: { type: 'string', maxLength: 64 },
          manufacturer: { type: 'string', maxLength: 255 },
          model: { type: 'string', maxLength: 255 },
        },
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as Record<string, string | undefined>;

      const changed: Record<string, string> = {};
      for (const field of ['deviceName', 'hostname', 'ipAddress', 'manufacturer', 'model'] as const) {
        const value = body[field];
        if (typeof value === 'string' && value.trim() !== '') {
          changed[field] = value.trim();
        }
      }

      if (Object.keys(changed).length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'No updatable fields supplied' },
        });
      }

      const device = await app.prisma.device.findUnique({ where: { id } });
      if (!device || (jwtUser.role !== 'SUPER_ADMIN' && device.organizationId !== jwtUser.organizationId)) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      const updated = await app.prisma.device.update({ where: { id: device.id }, data: changed });

      await app.prisma.auditLog.create({
        data: {
          organizationId: device.organizationId,
          actorId: jwtUser.sub,
          action: 'DEVICE_UPDATED',
          resource: 'DEVICE',
          resourceId: device.id,
          ipAddress: request.ip,
          metadata: JSON.stringify({ changed: Object.keys(changed) }),
        },
      });

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          deviceName: updated.deviceName,
          hostname: updated.hostname,
          ipAddress: updated.ipAddress,
          manufacturer: updated.manufacturer,
          model: updated.model,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    },
  });

  // Delete/Unenroll device
  app.delete('/:id', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Unenroll and remove a device from the organization',
      tags: ['Devices'],
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string' }
        }
      }
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { password } = (request.body as { password?: string }) || {};

      if (!password) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Admin password is required to delete a device' },
        });
      }

      const user = await app.prisma.user.findUnique({ where: { id: jwtUser.sub } });
      if (!user) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not found' },
        });
      }

      const device = await app.prisma.device.findUnique({ where: { id } });
      if (!device) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      if (jwtUser.role !== 'SUPER_ADMIN' && device.organizationId !== jwtUser.organizationId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Invalid admin password' },
        });
      }

      await app.prisma.auditLog.create({
        data: {
          organizationId: device.organizationId,
          actorId: jwtUser.sub,
          action: 'DEVICE_DELETED',
          resource: 'DEVICE',
          resourceId: device.id,
          ipAddress: request.ip,
          metadata: JSON.stringify({
            hostname: device.hostname,
            serialNumber: device.serialNumber,
            deviceName: device.deviceName,
          }),
        },
      });

      // Manually handle relations that don't have onDelete: Cascade in the schema
      await app.prisma.alert.deleteMany({ where: { deviceId: id } });
      await app.prisma.enrollmentToken.updateMany({
        where: { deviceId: id },
        data: { deviceId: null },
      });

      await app.prisma.device.delete({ where: { id } });

      return reply.send({
        success: true,
        message: 'Device unenrolled successfully',
      });
    },
  });
}
