import type { FastifyInstance } from 'fastify';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { authenticateAgent, hashAgentToken } from '../../middleware/agent-auth.middleware';
import { UserRole } from '@ricoz/shared-types';
import crypto from 'crypto';
import { z } from 'zod';

const deviceListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  os: z.string().optional(),
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

export async function devicesRoutes(app: FastifyInstance): Promise<void> {
  // Device Agent Enrollment Endpoint (Public agent registration)
  app.post('/enroll', {
    schema: {
      description: 'Enroll an endpoint device using an organization enrollment token',
      tags: ['Devices'],
      body: {
        type: 'object',
        required: ['enrollmentToken', 'hostname', 'serialNumber', 'os', 'osVersion', 'architecture', 'agentVersion'],
        properties: {
          enrollmentToken: { type: 'string' },
          hostname: { type: 'string' },
          serialNumber: { type: 'string' },
          os: { type: 'string' },
          osVersion: { type: 'string' },
          architecture: { type: 'string' },
          agentVersion: { type: 'string' },
          manufacturer: { type: 'string' },
          model: { type: 'string' },
          ipAddress: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const {
        enrollmentToken,
        hostname,
        serialNumber,
        os,
        osVersion,
        architecture,
        agentVersion,
        manufacturer = '',
        model = '',
        ipAddress = request.ip || '127.0.0.1',
      } = request.body as {
        enrollmentToken: string;
        hostname: string;
        serialNumber: string;
        os: string;
        osVersion: string;
        architecture: string;
        agentVersion: string;
        manufacturer?: string;
        model?: string;
        ipAddress?: string;
      };

      let targetOrg = await app.prisma.organization.findFirst();
      if (!targetOrg) {
        targetOrg = await app.prisma.organization.create({
          data: { name: 'Default Managed Organization' },
        });
      }

      if (!enrollmentToken.startsWith('RICOZ-ENROLL-') && enrollmentToken !== 'DEMO-TOKEN-123') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_ENROLLMENT_TOKEN',
            message: 'Invalid or malformed enrollment token format',
          },
        });
      }

      const device = await app.prisma.device.upsert({
        where: {
          organizationId_serialNumber: {
            organizationId: targetOrg.id,
            serialNumber,
          },
        },
        update: {
          hostname,
          deviceName: hostname,
          os,
          osVersion,
          architecture,
          agentVersion,
          manufacturer,
          model,
          ipAddress,
          status: 'ONLINE',
          lastSeenAt: new Date(),
        },
        create: {
          organizationId: targetOrg.id,
          deviceName: hostname,
          hostname,
          serialNumber,
          os,
          osVersion,
          architecture,
          agentVersion,
          manufacturer,
          model,
          ipAddress,
          status: 'ONLINE',
          lastSeenAt: new Date(),
        },
      });

      const rawAgentToken = `agtoken_${crypto.randomBytes(32).toString('hex')}`;
      const tokenHash = hashAgentToken(rawAgentToken);

      await app.prisma.agentToken.create({
        data: {
          organizationId: targetOrg.id,
          deviceId: device.id,
          tokenHash,
          isActive: true,
        },
      });

      // Note: no audit log here as enrollment is unauthenticated (no user context)



      return reply.status(201).send({
        success: true,
        data: {
          deviceId: device.id,
          organizationId: targetOrg.id,
          agentToken: rawAgentToken,
          heartbeatIntervalSeconds: 60,
          status: 'ONLINE',
        },
      });
    },
  });

  // Agent Heartbeat Endpoint (Protected by AgentToken)
  app.post('/heartbeat', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Periodic device agent heartbeat transmission',
      tags: ['Devices'],
      body: {
        type: 'object',
        properties: {
          agentVersion: { type: 'string' },
          ipAddress: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const agentContext = request.agent!;
      const { agentVersion = '', ipAddress = '' } = (request.body as { agentVersion?: string; ipAddress?: string }) || {};
      const now = new Date();

      const device = await app.prisma.device.update({
        where: { id: agentContext.deviceId },
        data: {
          status: 'ONLINE',
          lastSeenAt: now,
          ...(agentVersion ? { agentVersion } : {}),
          ...(ipAddress ? { ipAddress } : {}),
        },
      });

      await app.prisma.deviceHeartbeat.create({
        data: {
          deviceId: device.id,
          agentVersion: agentVersion || device.agentVersion,
          timestamp: now,
          status: 'ONLINE',
        },
      });

      const pendingCommands = await app.prisma.command.findMany({
        where: {
          deviceId: device.id,
          status: 'PENDING',
        },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({
        success: true,
        data: {
          status: 'ACKNOWLEDGED',
          serverTime: now.toISOString(),
          pendingCommands: pendingCommands.map((cmd) => ({
            id: cmd.id,
            type: cmd.type,
            createdAt: cmd.createdAt,
          })),
        },
      });
    },
  });

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

      const { search, status, os, sortBy, sortOrder = 'asc', page = 1, limit = 20 } = parsed.data;

      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

      await app.prisma.device.updateMany({
        where: {
          organizationId: jwtUser.organizationId,
          status: 'ONLINE',
          lastSeenAt: { lt: threeMinutesAgo },
        },
        data: { status: 'OFFLINE' },
      });

      const whereClause: Record<string, unknown> = {
        organizationId: jwtUser.role === 'SUPER_ADMIN' ? undefined : jwtUser.organizationId,
        ...(status ? { status } : {}),
        ...(os ? { os: { contains: os } } : {}),
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
        complianceStatus: (d as any).complianceStatus || 'COMPLIANT',
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

      // Fetch audit logs as activity
      const auditLogs = await app.prisma.auditLog.findMany({
        where: {
          organizationId: device.organizationId,
          OR: [{ resourceId: device.id }, { actorId: device.id }],
        },
        take: 20,
        orderBy: { timestamp: 'desc' },
      });

      const activity = [
        ...auditLogs.map((log) => ({
          id: log.id,
          type: log.action,
          timestamp: log.timestamp.toISOString(),
          description: `Action ${log.action} performed on device`,
        })),
        ...device.heartbeats.map((hb) => ({
          id: hb.id,
          type: 'HEARTBEAT',
          timestamp: hb.timestamp.toISOString(),
          description: `Device reported status ${hb.status}`,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const hardwareFormatted = device.hardware
        ? {
            ...device.hardware,
            ramBytes: String(device.hardware.ramBytes),
            storageBytes: String(device.hardware.storageBytes),
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
            complianceStatus: (device as any).complianceStatus || 'COMPLIANT',
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
      description: 'Get activity stream for a specific device',
      tags: ['Devices'],
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };

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

      const auditLogs = await app.prisma.auditLog.findMany({
        where: {
          organizationId: device.organizationId,
          OR: [{ resourceId: device.id }, { actorId: device.id }],
        },
        take: 20,
        orderBy: { timestamp: 'desc' },
      });

      const activity = [
        ...auditLogs.map((log) => ({
          id: log.id,
          type: log.action,
          timestamp: log.timestamp.toISOString(),
          description: `Action ${log.action} performed on device`,
        })),
        ...device.heartbeats.map((hb) => ({
          id: hb.id,
          type: 'HEARTBEAT',
          timestamp: hb.timestamp.toISOString(),
          description: `Device reported status ${hb.status}`,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return reply.send({
        success: true,
        data: activity,
      });
    },
  });

  // Delete/Unenroll device
  app.delete('/:id', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Unenroll and remove a device from the organization',
      tags: ['Devices'],
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };

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

      await app.prisma.device.delete({ where: { id } });

      return reply.send({
        success: true,
        message: 'Device unenrolled successfully',
      });
    },
  });
}