import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  authenticate,
  JwtPayload,
} from '../../middleware/rbac.middleware';
import {
  deviceListQuerySchema,
  deviceParamsSchema,
  deviceActivityQuerySchema,
} from '@ricoz/validation';

// ─── Serialization helpers ───────────────────────────────────────────────────

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function deviceSummary(device: {
  id: string;
  deviceName: string;
  hostname: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  os: string;
  osVersion: string;
  ipAddress: string;
  agentVersion: string;
  status: string;
  lastSeenAt: Date | null;
  registeredAt: Date;
  createdAt: Date;
  complianceResults?: { status: string }[];
}): Record<string, unknown> {
  return {
    id: device.id,
    deviceName: device.deviceName,
    hostname: device.hostname,
    serialNumber: device.serialNumber,
    manufacturer: device.manufacturer,
    model: device.model,
    os: device.os,
    osVersion: device.osVersion,
    ipAddress: device.ipAddress,
    agentVersion: device.agentVersion,
    status: device.status,
    lastSeenAt: toIso(device.lastSeenAt),
    registeredAt: toIso(device.registeredAt),
    createdAt: toIso(device.createdAt),
    complianceStatus: complianceStatus(device.complianceResults ?? []),
  };
}

function complianceStatus(results: { status: string }[]): string {
  if (results.length === 0) return 'NOT_EVALUATED';
  if (results.some((result) => result.status === 'NON_COMPLIANT')) return 'NON_COMPLIANT';
  return 'COMPLIANT';
}

// ─── OpenAPI schemas ──────────────────────────────────────────────────────────

const DEVICE_STATUSES = ['ONLINE', 'OFFLINE', 'UNKNOWN', 'PENDING', 'NON_COMPLIANT'];

const deviceSummarySchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    deviceName: { type: 'string' },
    hostname: { type: 'string' },
    serialNumber: { type: 'string' },
    manufacturer: { type: 'string' },
    model: { type: 'string' },
    os: { type: 'string' },
    osVersion: { type: 'string' },
    ipAddress: { type: 'string' },
    agentVersion: { type: 'string' },
    status: { type: 'string', enum: DEVICE_STATUSES },
    lastSeenAt: { type: ['string', 'null'] },
    registeredAt: { type: 'string' },
    createdAt: { type: 'string' },
    complianceStatus: { type: 'string' },
  },
};

const paginationSchema = {
  type: 'object',
  properties: {
    page: { type: 'number' },
    limit: { type: 'number' },
    total: { type: 'number' },
    totalPages: { type: 'number' },
  },
};

interface ActivityEvent {
  id: string;
  type: 'HEARTBEAT' | 'COMMAND' | 'ALERT';
  timestamp: string;
  status?: string;
  severity?: string;
  description: string;
}

type ActivitySource = {
  heartbeats?: { id: string; timestamp: Date; status: string }[];
  commands?: { id: string; createdAt: Date; type: string; status: string }[];
  alerts?: { id: string; createdAt: Date; severity: string; status: string; title: string }[];
};

function buildActivity(source: ActivitySource): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const heartbeat of source.heartbeats ?? []) {
    events.push({
      id: heartbeat.id,
      type: 'HEARTBEAT',
      timestamp: heartbeat.timestamp.toISOString(),
      status: heartbeat.status,
      description: `Heartbeat reported with status ${heartbeat.status}`,
    });
  }

  for (const command of source.commands ?? []) {
    events.push({
      id: command.id,
      type: 'COMMAND',
      timestamp: command.createdAt.toISOString(),
      status: command.status,
      description: `Command ${command.type} ${command.status}`,
    });
  }

  for (const alert of source.alerts ?? []) {
    events.push({
      id: alert.id,
      type: 'ALERT',
      timestamp: alert.createdAt.toISOString(),
      severity: alert.severity,
      status: alert.status,
      description: `${alert.severity}: ${alert.title}`,
    });
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function devicesRoutes(app: FastifyInstance): Promise<void> {
  // List devices with pagination / search / filtering / sorting
  app.get('/', {
    preHandler: [authenticate],
    schema: {
      description: 'List devices available to the caller with pagination, search, status and OS filtering',
      tags: ['Devices'],
      querystring: {
        type: 'object',
        additionalProperties: true,
        properties: {
          page: { type: 'string', description: 'Page number (1-based)' },
          limit: { type: 'string', description: 'Items per page (1-100)' },
          search: { type: 'string', description: 'Free text search across device fields' },
          status: { type: 'string', enum: DEVICE_STATUSES, description: 'Filter by device status' },
          os: { type: 'string', description: 'Filter by operating system (case-insensitive)' },
          sortBy: {
            type: 'string',
            enum: ['deviceName', 'hostname', 'serialNumber', 'manufacturer', 'model', 'os', 'osVersion', 'ipAddress', 'agentVersion', 'status', 'lastSeenAt', 'registeredAt', 'createdAt', 'updatedAt'],
            description: 'Field to sort by',
          },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: deviceSummarySchema },
            pagination: paginationSchema,
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
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

      const { page, limit, search, status, os, sortBy, sortOrder } = parsed.data;

      const orgFilter: Prisma.DeviceWhereInput =
        jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

      const searchFilter: Prisma.DeviceWhereInput | undefined = search
        ? {
            OR: [
              { deviceName: { contains: search, mode: 'insensitive' } },
              { hostname: { contains: search, mode: 'insensitive' } },
              { serialNumber: { contains: search, mode: 'insensitive' } },
              { manufacturer: { contains: search, mode: 'insensitive' } },
              { model: { contains: search, mode: 'insensitive' } },
              { ipAddress: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined;

      const where: Prisma.DeviceWhereInput = {
        ...orgFilter,
        ...(status ? { status } : {}),
        ...(os ? { os: { contains: os, mode: 'insensitive' } } : {}),
        ...(searchFilter ? searchFilter : {}),
      };

      const orderBy = { [sortBy]: sortOrder } as Prisma.DeviceOrderByWithRelationInput;

      const [total, devices] = await Promise.all([
        app.prisma.device.count({ where }),
        app.prisma.device.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            deviceName: true,
            hostname: true,
            serialNumber: true,
            manufacturer: true,
            model: true,
            os: true,
            osVersion: true,
            ipAddress: true,
            agentVersion: true,
            status: true,
            lastSeenAt: true,
            registeredAt: true,
            createdAt: true,
            complianceResults: { select: { status: true } },
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: devices.map(deviceSummary),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  });

  // Get a single device with full details
  app.get('/:id', {
    preHandler: [authenticate],
    schema: {
      description: 'Get device detail including hardware, software, policies, compliance, commands and activity',
      tags: ['Devices'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = deviceParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid device id',
          },
        });
      }

      const orgFilter: Prisma.DeviceWhereInput =
        jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

      const device = await app.prisma.device.findFirst({
        where: { id: params.data.id, ...orgFilter },
        include: {
          hardware: true,
          software: { orderBy: { name: 'asc' } },
          policies: { include: { policy: true }, orderBy: { createdAt: 'desc' } },
          complianceResults: { include: { rule: true }, orderBy: { evaluatedAt: 'desc' } },
          commands: { orderBy: { createdAt: 'desc' }, take: 20 },
          heartbeats: { orderBy: { timestamp: 'desc' }, take: 20 },
          alerts: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });

      if (!device) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      return reply.send({
        success: true,
        data: {
          overview: {
            id: device.id,
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
            lastSeenAt: toIso(device.lastSeenAt),
            registeredAt: toIso(device.registeredAt),
            createdAt: toIso(device.createdAt),
            updatedAt: toIso(device.updatedAt),
            complianceStatus: complianceStatus(device.complianceResults),
          },
          hardware: device.hardware
            ? {
                id: device.hardware.id,
                cpu: device.hardware.cpu,
                cpuCores: device.hardware.cpuCores,
                ramBytes: device.hardware.ramBytes.toString(),
                storageBytes: device.hardware.storageBytes.toString(),
                manufacturer: device.hardware.manufacturer,
                model: device.hardware.model,
                serialNumber: device.hardware.serialNumber,
                biosVersion: device.hardware.biosVersion,
              }
            : null,
          software: device.software.map((item) => ({
            id: item.id,
            name: item.name,
            version: item.version,
            publisher: item.publisher,
            installDate: toIso(item.installDate),
            architecture: item.architecture,
          })),
          policies: device.policies.map((assignment) => ({
            id: assignment.id,
            priority: assignment.priority,
            createdAt: toIso(assignment.createdAt),
            policy: {
              id: assignment.policy.id,
              name: assignment.policy.name,
              type: assignment.policy.type,
              description: assignment.policy.description,
              isActive: assignment.policy.isActive,
            },
          })),
          compliance: device.complianceResults.map((result) => ({
            id: result.id,
            status: result.status,
            reason: result.reason,
            evaluatedAt: toIso(result.evaluatedAt),
            rule: result.rule
              ? {
                  id: result.rule.id,
                  name: result.rule.name,
                  ruleType: result.rule.ruleType,
                  description: result.rule.description,
                }
              : null,
          })),
          commands: device.commands.map((command) => ({
            id: command.id,
            type: command.type,
            status: command.status,
            requestedBy: command.requestedBy,
            createdAt: toIso(command.createdAt),
            startedAt: toIso(command.startedAt),
            completedAt: toIso(command.completedAt),
            result: command.result,
            errorMessage: command.errorMessage,
          })),
          activity: buildActivity(device),
        },
      });
    },
  });

  // Get device hardware inventory
  app.get('/:id/hardware', {
    preHandler: [authenticate],
    schema: {
      description: 'Get device hardware inventory',
      tags: ['Devices'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = deviceParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid device id',
          },
        });
      }

      const orgFilter: Prisma.DeviceWhereInput =
        jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

      const device = await app.prisma.device.findFirst({
        where: { id: params.data.id, ...orgFilter },
        select: { id: true, hardware: true },
      });

      if (!device) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      return reply.send({
        success: true,
        data: device.hardware
          ? {
              id: device.hardware.id,
              cpu: device.hardware.cpu,
              cpuCores: device.hardware.cpuCores,
              ramBytes: device.hardware.ramBytes.toString(),
              storageBytes: device.hardware.storageBytes.toString(),
              manufacturer: device.hardware.manufacturer,
              model: device.hardware.model,
              serialNumber: device.hardware.serialNumber,
              biosVersion: device.hardware.biosVersion,
            }
          : null,
      });
    },
  });

  // Get device software inventory
  app.get('/:id/software', {
    preHandler: [authenticate],
    schema: {
      description: 'Get device installed software inventory',
      tags: ['Devices'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = deviceParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid device id',
          },
        });
      }

      const orgFilter: Prisma.DeviceWhereInput =
        jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

      const device = await app.prisma.device.findFirst({
        where: { id: params.data.id, ...orgFilter },
        select: { id: true },
      });

      if (!device) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      const software = await app.prisma.deviceSoftware.findMany({
        where: { deviceId: device.id },
        orderBy: { name: 'asc' },
      });

      return reply.send({
        success: true,
        data: software.map((item) => ({
          id: item.id,
          name: item.name,
          version: item.version,
          publisher: item.publisher,
          installDate: toIso(item.installDate),
          architecture: item.architecture,
        })),
      });
    },
  });

  // Get device activity stream
  app.get('/:id/activity', {
    preHandler: [authenticate],
    schema: {
      description: 'Get device activity feed from heartbeats, commands and alerts',
      tags: ['Devices'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      querystring: {
        type: 'object',
        additionalProperties: true,
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = deviceParamsSchema.safeParse(request.params);
      const query = deviceActivityQuerySchema.safeParse(request.query);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid device id',
          },
        });
      }

      if (!query.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: query.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const orgFilter: Prisma.DeviceWhereInput =
        jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

      const device = await app.prisma.device.findFirst({
        where: { id: params.data.id, ...orgFilter },
        select: { id: true },
      });

      if (!device) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found' },
        });
      }

      const [heartbeats, commands, alerts] = await Promise.all([
        app.prisma.deviceHeartbeat.findMany({
          where: { deviceId: device.id },
          orderBy: { timestamp: 'desc' },
          take: query.data.limit,
          select: { id: true, timestamp: true, status: true },
        }),
        app.prisma.command.findMany({
          where: { deviceId: device.id },
          orderBy: { createdAt: 'desc' },
          take: query.data.limit,
          select: { id: true, createdAt: true, type: true, status: true },
        }),
        app.prisma.alert.findMany({
          where: { deviceId: device.id },
          orderBy: { createdAt: 'desc' },
          take: query.data.limit,
          select: { id: true, createdAt: true, severity: true, status: true, title: true },
        }),
      ]);

      return reply.send({
        success: true,
        data: buildActivity({ heartbeats, commands, alerts }).slice(0, query.data.limit),
      });
    },
  });
}