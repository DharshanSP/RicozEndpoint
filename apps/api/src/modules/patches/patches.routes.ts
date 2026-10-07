import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import {
  patchListQuerySchema,
  patchParamsSchema,
  patchCreateSchema,
  patchUpdateSchema,
  patchDeploySchema,
  deviceParamsSchema,
} from '@ricoz/validation';
import { writeAudit } from '../../utils/audit';

const ACTIVE_COMMAND_STATUSES = ['QUEUED', 'SENT', 'RUNNING'];

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

interface PatchRow {
  id: string;
  organizationId: string;
  kbNumber: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  status: string;
  releaseDate: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function patchDetails(patch: PatchRow): Record<string, unknown> {
  return {
    id: patch.id,
    organizationId: patch.organizationId,
    kbNumber: patch.kbNumber,
    title: patch.title,
    description: patch.description,
    severity: patch.severity,
    category: patch.category,
    status: patch.status,
    releaseDate: toIso(patch.releaseDate),
    createdById: patch.createdById,
    createdAt: toIso(patch.createdAt),
    updatedAt: toIso(patch.updatedAt),
  };
}

export async function patchesRoutes(app: FastifyInstance): Promise<void> {
  const patchScope = (jwtUser: JwtPayload): Prisma.PatchWhereInput =>
    jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

  const deviceScope = (jwtUser: JwtPayload): Prisma.DeviceWhereInput =>
    jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

  const groupCount = (
    rows: Array<{ _count: { _all: number }; severity?: string; status?: string }>,
    key: 'severity' | 'status',
    value: string
  ): number => rows.find((row) => row[key] === value)?._count._all ?? 0;

  // ─── List patches (org-scoped) ──────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'List the patch catalog with per-patch install coverage and fleet summary',
      tags: ['Patches'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          severity: { type: 'string', enum: ['CRITICAL', 'IMPORTANT', 'OPTIONAL'] },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DEPLOYED'] },
          search: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const query = patchListQuerySchema.safeParse(request.query);

      if (!query.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: query.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { page, limit, severity, status, search } = query.data;
      const scoped = patchScope(jwtUser);

      const where: Prisma.PatchWhereInput = {
        ...scoped,
        ...(severity ? { severity } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { kbNumber: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [total, items, deviceCounts, severityGroups, statusGroups, patchOrgGroups, installedAgg] =
        await Promise.all([
          app.prisma.patch.count({ where }),
          app.prisma.patch.findMany({
            where,
            orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
            include: { devices: { select: { status: true } } },
          }),
          app.prisma.device.groupBy({
            by: ['organizationId'],
            where: deviceScope(jwtUser),
            _count: { _all: true },
          }),
          app.prisma.patch.groupBy({
            by: ['severity'],
            where: scoped,
            _count: { _all: true },
          }),
          app.prisma.patch.groupBy({
            by: ['status'],
            where: scoped,
            _count: { _all: true },
          }),
          app.prisma.patch.groupBy({
            by: ['organizationId'],
            where: scoped,
            _count: { _all: true },
          }),
          app.prisma.devicePatch.aggregate({
            where: { status: 'INSTALLED', patch: scoped },
            _count: { _all: true },
          }),
        ]);

      const deviceCountByOrg = new Map(
        deviceCounts.map((row) => [row.organizationId, row._count._all])
      );

      const patchRows = items.map((patch) => {
        const installedCount = patch.devices.filter((row) => row.status === 'INSTALLED').length;
        const failedCount = patch.devices.filter((row) => row.status === 'FAILED').length;
        const totalDevices = deviceCountByOrg.get(patch.organizationId) ?? 0;
        const missingCount = Math.max(0, totalDevices - installedCount);

        return {
          ...patchDetails(patch),
          installedCount,
          failedCount,
          missingCount,
          totalDevices,
          affectedDevices: missingCount,
        };
      });

      const applicable = patchOrgGroups.reduce(
        (sum, row) => sum + row._count._all * (deviceCountByOrg.get(row.organizationId) ?? 0),
        0
      );
      const installedTotal = installedAgg._count._all;

      return reply.send({
        success: true,
        data: {
          items: patchRows,
          total,
          page,
          limit,
          summary: {
            total,
            critical: groupCount(severityGroups, 'severity', 'CRITICAL'),
            important: groupCount(severityGroups, 'severity', 'IMPORTANT'),
            optional: groupCount(severityGroups, 'severity', 'OPTIONAL'),
            pending: groupCount(statusGroups, 'status', 'PENDING'),
            approved: groupCount(statusGroups, 'status', 'APPROVED'),
            deployed: groupCount(statusGroups, 'status', 'DEPLOYED'),
            upToDatePercent:
              applicable > 0 ? Math.min(100, Math.round((installedTotal / applicable) * 100)) : null,
          },
        },
      });
    },
  });

  // ─── Patches for a single device ───────────────────────────────────────────
  app.get('/device/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'List every catalog patch alongside its install state on one device',
      tags: ['Patches'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
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

      const device = await app.prisma.device.findFirst({
        where: {
          id: params.data.id,
          ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
        },
        select: {
          id: true,
          organizationId: true,
          deviceName: true,
          hostname: true,
          ipAddress: true,
          status: true,
          lastSeenAt: true,
        },
      });

      if (!device) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device not found in your organization' },
        });
      }

      const [patches, rows, commands] = await Promise.all([
        app.prisma.patch.findMany({ where: { organizationId: device.organizationId } }),
        app.prisma.devicePatch.findMany({
          where: { deviceId: device.id },
          select: { patchId: true, status: true, installedAt: true, lastReportedAt: true },
        }),
        app.prisma.command.findMany({
          where: {
            deviceId: device.id,
            type: 'INSTALL_PATCH',
            patchId: { not: null },
            status: { in: ACTIVE_COMMAND_STATUSES },
          },
          select: { id: true, patchId: true, status: true, createdAt: true },
        }),
      ]);

      const stateByPatch = new Map(rows.map((row) => [row.patchId, row]));
      const commandByPatch = new Map(
        commands.filter((row) => row.patchId).map((row) => [row.patchId as string, row])
      );

      let installed = 0;
      let failed = 0;
      let missing = 0;

      const items = patches.map((patch) => {
        const state = stateByPatch.get(patch.id);
        const deviceStatus = state?.status ?? 'MISSING';
        if (deviceStatus === 'INSTALLED') installed += 1;
        else if (deviceStatus === 'FAILED') failed += 1;
        else missing += 1;

        return {
          ...patchDetails(patch),
          deviceStatus,
          installedAt: toIso(state?.installedAt),
          lastReportedAt: toIso(state?.lastReportedAt),
          command: commandByPatch.get(patch.id) ?? null,
        };
      });

      return reply.send({
        success: true,
        data: {
          device: { ...device, lastSeenAt: toIso(device.lastSeenAt) },
          summary: { total: items.length, installed, failed, missing },
          items,
        },
      });
    },
  });

  // ─── Get patch by id (with per-device coverage) ────────────────────────────
  app.get('/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get a patch with the install state of every device in its organization',
      tags: ['Patches'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = patchParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid patch id',
          },
        });
      }

      const patch = await app.prisma.patch.findFirst({
        where: { id: params.data.id, ...patchScope(jwtUser) },
      });

      if (!patch) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Patch not found' },
        });
      }

      const [devices, rows, commands] = await Promise.all([
        app.prisma.device.findMany({
          where: { organizationId: patch.organizationId },
          select: {
            id: true,
            deviceName: true,
            hostname: true,
            ipAddress: true,
            status: true,
            lastSeenAt: true,
          },
          orderBy: { deviceName: 'asc' },
        }),
        app.prisma.devicePatch.findMany({
          where: { patchId: patch.id },
          select: { deviceId: true, status: true, installedAt: true, lastReportedAt: true },
        }),
        app.prisma.command.findMany({
          where: { patchId: patch.id, status: { in: ACTIVE_COMMAND_STATUSES } },
          select: { id: true, deviceId: true, status: true, createdAt: true },
        }),
      ]);

      const stateByDevice = new Map(rows.map((row) => [row.deviceId, row]));
      const commandByDevice = new Map(commands.map((row) => [row.deviceId, row]));

      let installed = 0;
      let failed = 0;
      let missing = 0;
      let inFlight = 0;

      const deviceRows = devices.map((device) => {
        const state = stateByDevice.get(device.id);
        const deviceStatus = state?.status ?? 'MISSING';
        const command = commandByDevice.get(device.id) ?? null;
        if (deviceStatus === 'INSTALLED') installed += 1;
        else if (deviceStatus === 'FAILED') failed += 1;
        else missing += 1;
        if (command) inFlight += 1;

        return {
          id: device.id,
          deviceName: device.deviceName,
          hostname: device.hostname,
          ipAddress: device.ipAddress,
          status: device.status,
          lastSeenAt: toIso(device.lastSeenAt),
          patchStatus: deviceStatus,
          installedAt: toIso(state?.installedAt),
          lastReportedAt: toIso(state?.lastReportedAt),
          command,
        };
      });

      return reply.send({
        success: true,
        data: {
          ...patchDetails(patch),
          summary: {
            totalDevices: devices.length,
            installed,
            failed,
            missing,
            inFlight,
          },
          devices: deviceRows,
        },
      });
    },
  });

  // ─── Create a patch entry (IT Admin+) ──────────────────────────────────────
  app.post('/', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Add a patch to the catalog. kbNumber must look like KB1234567',
      tags: ['Patches'],
      body: {
        type: 'object',
        required: ['kbNumber', 'title'],
        additionalProperties: true,
        properties: {
          kbNumber: { type: 'string', minLength: 3, maxLength: 64 },
          title: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 2000 },
          severity: { type: 'string', enum: ['CRITICAL', 'IMPORTANT', 'OPTIONAL'] },
          category: { type: 'string', maxLength: 120 },
          releaseDate: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DEPLOYED'] },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const body = patchCreateSchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid patch payload',
            details: body.error.issues,
          },
        });
      }

      const kbNumber = body.data.kbNumber.trim().toUpperCase();
      const organizationId = jwtUser.organizationId;

      const existing = await app.prisma.patch.findUnique({
        where: { organizationId_kbNumber: { organizationId, kbNumber } },
      });

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: `${kbNumber} already exists in this catalog` },
        });
      }

      const patch = await app.prisma.patch.create({
        data: {
          organizationId,
          kbNumber,
          title: body.data.title.trim(),
          description: body.data.description?.trim() ?? '',
          severity: body.data.severity,
          category: body.data.category?.trim() || 'Security Updates',
          releaseDate: body.data.releaseDate ?? null,
          status: body.data.status ?? 'PENDING',
          createdById: jwtUser.sub,
        },
      });

      await writeAudit(app.prisma, jwtUser, 'PATCH_CREATED', 'PATCH', patch.id, {
        kbNumber: patch.kbNumber,
        severity: patch.severity,
        status: patch.status,
      }, request);

      return reply.status(201).send({ success: true, data: patchDetails(patch) });
    },
  });

  // ─── Update a patch entry (IT Admin+) ──────────────────────────────────────
  app.patch('/:id', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Update patch metadata or move it through PENDING → APPROVED → DEPLOYED',
      tags: ['Patches'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 2000 },
          severity: { type: 'string', enum: ['CRITICAL', 'IMPORTANT', 'OPTIONAL'] },
          category: { type: 'string', maxLength: 120 },
          releaseDate: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DEPLOYED'] },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = patchParamsSchema.safeParse(request.params);
      const body = patchUpdateSchema.safeParse(request.body ?? {});

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid patch id',
          },
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid patch payload',
            details: body.error.issues,
          },
        });
      }

      const patch = await app.prisma.patch.findFirst({
        where: { id: params.data.id, ...patchScope(jwtUser) },
      });

      if (!patch) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Patch not found' },
        });
      }

      const input = body.data;
      const updated = await app.prisma.patch.update({
        where: { id: patch.id },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.severity !== undefined ? { severity: input.severity } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.releaseDate !== undefined ? { releaseDate: input.releaseDate } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });

      await writeAudit(app.prisma, jwtUser, 'PATCH_UPDATED', 'PATCH', patch.id, {
        kbNumber: patch.kbNumber,
        changes: input as Record<string, unknown>,
      }, request);

      return reply.send({ success: true, data: patchDetails(updated) });
    },
  });

  // ─── Deploy a patch (IT Admin+) ────────────────────────────────────────────
  app.post('/:id/deploy', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description:
        'Queue an INSTALL_PATCH command on every device in the patch organization that is missing it (or on an explicit device list)',
      tags: ['Patches'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          deviceIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 500 },
          confirmed: { type: 'boolean', default: false },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = patchParamsSchema.safeParse(request.params);
      const body = patchDeploySchema.safeParse(request.body ?? {});

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid patch id',
          },
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid deployment payload',
          },
        });
      }

      if (!body.data.confirmed) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Patch deployment requires confirmed: true',
          },
        });
      }

      const patch = await app.prisma.patch.findFirst({
        where: { id: params.data.id, ...patchScope(jwtUser) },
      });

      if (!patch) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Patch not found' },
        });
      }

      const requestedIds = body.data.deviceIds ?? [];
      const requestedGroupIds = body.data.groupIds ?? [];
      let targets: Array<{ id: string; deviceName: string }>;

      if (requestedIds.length > 0) {
        const found = await app.prisma.device.findMany({
          where: { id: { in: requestedIds }, organizationId: patch.organizationId },
          select: { id: true, deviceName: true },
        });
        const foundIds = new Set(found.map((device) => device.id));
        const unknown = requestedIds.filter((id) => !foundIds.has(id));

        if (unknown.length > 0) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Devices not found in the patch organization: ${unknown.join(', ')}`,
            },
          });
        }
        targets = found;
      } else if (requestedGroupIds.length > 0) {
        const members = await app.prisma.deviceGroupMember.findMany({
          where: {
            groupId: { in: requestedGroupIds },
            group: { organizationId: patch.organizationId },
          },
          select: { deviceId: true, device: { select: { id: true, deviceName: true } } },
        });
        const dedup = new Map<string, { id: string; deviceName: string }>();
        for (const member of members) {
          dedup.set(member.deviceId, { id: member.device.id, deviceName: member.device.deviceName });
        }
        targets = [...dedup.values()];
        if (targets.length === 0) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'No devices found in the requested groups',
            },
          });
        }
      } else {
        targets = await app.prisma.device.findMany({
          where: { organizationId: patch.organizationId },
          select: { id: true, deviceName: true },
        });
      }

      const [states, activeCommands] = await Promise.all([
        app.prisma.devicePatch.findMany({
          where: { patchId: patch.id, deviceId: { in: targets.map((device) => device.id) } },
          select: { deviceId: true, status: true },
        }),
        app.prisma.command.findMany({
          where: {
            patchId: patch.id,
            deviceId: { in: targets.map((device) => device.id) },
            status: { in: ACTIVE_COMMAND_STATUSES },
          },
          select: { deviceId: true },
        }),
      ]);

      const installedIds = new Set(
        states.filter((row) => row.status === 'INSTALLED').map((row) => row.deviceId)
      );
      const inFlightIds = new Set(activeCommands.map((row) => row.deviceId));
      const queued = targets.filter(
        (device) => !installedIds.has(device.id) && !inFlightIds.has(device.id)
      );

      if (queued.length > 0) {
        const payload = JSON.stringify({
          patchId: patch.id,
          kbNumber: patch.kbNumber,
          title: patch.title,
        });

        await app.prisma.command.createMany({
          data: queued.map((device) => ({
            organizationId: patch.organizationId,
            deviceId: device.id,
            type: 'INSTALL_PATCH',
            status: 'QUEUED',
            requestedBy: jwtUser.sub,
            patchId: patch.id,
            result: payload,
          })),
        });

        if (patch.status !== 'DEPLOYED') {
          await app.prisma.patch.update({
            where: { id: patch.id },
            data: { status: 'DEPLOYED' },
          });
        }
      }

      await writeAudit(app.prisma, jwtUser, 'PATCH_DEPLOYED', 'PATCH', patch.id, {
        kbNumber: patch.kbNumber,
        queued: queued.length,
        skippedInstalled: installedIds.size,
        skippedInFlight: inFlightIds.size,
        deviceIds: queued.map((device) => device.id),
      }, request);

      return reply.send({
        success: true,
        data: {
          patch: patchDetails(
            queued.length > 0 && patch.status !== 'DEPLOYED' ? { ...patch, status: 'DEPLOYED' } : patch
          ),
          queued: queued.length,
          skippedInstalled: installedIds.size,
          skippedInFlight: inFlightIds.size,
          deviceIds: queued.map((device) => device.id),
        },
      });
    },
  });

  // ─── Retry failed installs (IT Admin+) ─────────────────────────────────────
  app.post('/:id/retry', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Re-queue INSTALL_PATCH commands for devices whose last install failed',
      tags: ['Patches'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: true,
        properties: { confirmed: { type: 'boolean', default: false } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = patchParamsSchema.safeParse(request.params);
      const body = (request.body ?? {}) as { confirmed?: boolean };
      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid patch id' },
        });
      }
      if (!body.confirmed) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Retry requires confirmed: true' },
        });
      }
      const patch = await app.prisma.patch.findFirst({
        where: { id: params.data.id, ...patchScope(jwtUser) },
      });
      if (!patch) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Patch not found' },
        });
      }

      const failed = await app.prisma.devicePatch.findMany({
        where: { patchId: patch.id, status: 'FAILED' },
        select: { deviceId: true },
      });
      const failedIds = failed.map((row) => row.deviceId);
      if (failedIds.length === 0) {
        return reply.send({ success: true, data: { patch: patchDetails(patch), retried: 0, deviceIds: [] } });
      }

      const inFlight = await app.prisma.command.findMany({
        where: { patchId: patch.id, deviceId: { in: failedIds }, status: { in: ACTIVE_COMMAND_STATUSES } },
        select: { deviceId: true },
      });
      const inFlightIds = new Set(inFlight.map((row) => row.deviceId));
      const retryIds = failedIds.filter((id) => !inFlightIds.has(id));

      if (retryIds.length > 0) {
        const payload = JSON.stringify({ patchId: patch.id, kbNumber: patch.kbNumber, title: patch.title });
        await app.prisma.command.createMany({
          data: retryIds.map((deviceId) => ({
            organizationId: patch.organizationId,
            deviceId,
            type: 'INSTALL_PATCH',
            status: 'QUEUED',
            requestedBy: jwtUser.sub,
            patchId: patch.id,
            result: payload,
          })),
        });
      }

      await writeAudit(app.prisma, jwtUser, 'PATCH_RETRY', 'PATCH', patch.id, {
        kbNumber: patch.kbNumber,
        retried: retryIds.length,
        skippedInFlight: inFlightIds.size,
      }, request);

      return reply.send({
        success: true,
        data: { patch: patchDetails(patch), retried: retryIds.length, skippedInFlight: inFlightIds.size, deviceIds: retryIds },
      });
    },
  });

  // ─── Cancel in-flight deployment (IT Admin+) ───────────────────────────────
  app.post('/:id/cancel', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Cancel queued INSTALL_PATCH commands for a patch',
      tags: ['Patches'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: true,
        properties: { confirmed: { type: 'boolean', default: false } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = patchParamsSchema.safeParse(request.params);
      const body = (request.body ?? {}) as { confirmed?: boolean };
      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid patch id' },
        });
      }
      if (!body.confirmed) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Cancel requires confirmed: true' },
        });
      }
      const patch = await app.prisma.patch.findFirst({
        where: { id: params.data.id, ...patchScope(jwtUser) },
      });
      if (!patch) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Patch not found' },
        });
      }

      const cancelled = await app.prisma.command.updateMany({
        where: { patchId: patch.id, status: 'QUEUED' },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });

      await writeAudit(app.prisma, jwtUser, 'PATCH_DEPLOY_CANCELLED', 'PATCH', patch.id, {
        kbNumber: patch.kbNumber,
        cancelled: cancelled.count,
      }, request);

      return reply.send({ success: true, data: { patch: patchDetails(patch), cancelled: cancelled.count } });
    },
  });

  // ─── Delete a patch entry (IT Admin+) ──────────────────────────────────────
  app.delete('/:id', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Remove a patch from the catalog (blocked while installs are in flight)',
      tags: ['Patches'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = patchParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid patch id' },
        });
      }
      const patch = await app.prisma.patch.findFirst({
        where: { id: params.data.id, ...patchScope(jwtUser) },
      });
      if (!patch) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Patch not found' },
        });
      }

      const inFlight = await app.prisma.command.count({
        where: { patchId: patch.id, status: { in: ACTIVE_COMMAND_STATUSES } },
      });
      if (inFlight > 0) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Cannot delete ${patch.kbNumber}: ${inFlight} install command(s) still in flight. Cancel them first.`,
          },
        });
      }

      await app.prisma.$transaction([
        app.prisma.devicePatch.deleteMany({ where: { patchId: patch.id } }),
        app.prisma.patch.delete({ where: { id: patch.id } }),
      ]);

      await writeAudit(app.prisma, jwtUser, 'PATCH_DELETED', 'PATCH', patch.id, {
        kbNumber: patch.kbNumber,
        title: patch.title,
      }, request);

      return reply.send({ success: true, data: { id: patch.id, kbNumber: patch.kbNumber } });
    },
  });
}
