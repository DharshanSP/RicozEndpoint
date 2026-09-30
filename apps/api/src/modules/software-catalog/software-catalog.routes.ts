import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import {
  softwareCatalogQuerySchema,
  softwareDeploySchema,
  softwareDeploymentsQuerySchema,
} from '@ricoz/validation';
import { writeAudit } from '../../utils/audit';

const ACTIVE_COMMAND_STATUSES = ['QUEUED', 'SENT', 'RUNNING'];
const MAX_ROWS = 10_000;

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

interface SoftwareRow {
  name: string;
  version: string;
  publisher: string;
  deviceId: string;
}

interface VersionBucket {
  version: string;
  count: number;
}

interface CatalogItem {
  id: string;
  name: string;
  publisher: string;
  deviceCount: number;
  versions: VersionBucket[];
  latestVersion: string;
  installerUrl: string;
}

interface AggState {
  name: string;
  publisher: string;
  deviceCount: number;
  versions: VersionBucket[];
  latestVersion: string;
  seenDevices: Set<string>;
  seenVersions: Set<string>;
}

interface ManagedApplication {
  id: string;
  name: string;
  version: string;
  publisher: string;
  installerUrl: string;
}

interface ResolvedTarget {
  id: string;
  deviceName: string;
  organizationId: string;
}

function countCompare(a: string, b: string): number {
  const am = Number.parseInt(a.replace(/\D/g, ''), 10) || 0;
  const bm = Number.parseInt(b.replace(/\D/g, ''), 10) || 0;
  return bm - am;
}

function deploymentDetails(deployment: {
  id: string;
  organizationId: string;
  applicationId: string;
  deviceId: string;
  action: string;
  status: string;
  requestedBy: string | null;
  errorMessage: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: deployment.id,
    organizationId: deployment.organizationId,
    applicationId: deployment.applicationId,
    deviceId: deployment.deviceId,
    action: deployment.action,
    status: deployment.status,
    requestedBy: deployment.requestedBy,
    errorMessage: deployment.errorMessage,
    completedAt: toIso(deployment.completedAt),
    createdAt: toIso(deployment.createdAt),
    updatedAt: toIso(deployment.updatedAt),
  };
}

function validationError(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    success: false,
    error: { code: 'VALIDATION_ERROR', message },
  });
}

function notFound(reply: FastifyReply, message: string) {
  return reply.status(404).send({
    success: false,
    error: { code: 'NOT_FOUND', message },
  });
}

export async function softwareCatalogRoutes(app: FastifyInstance): Promise<void> {
  const deviceScope = (jwtUser: JwtPayload): Prisma.DeviceWhereInput =>
    jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

  const orgScope = (jwtUser: JwtPayload): Prisma.DeploymentWhereInput =>
    jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

  // ─── Software catalog ───────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Aggregate software catalog across the organization inventory',
      tags: ['Software Catalog'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          sortBy: { type: 'string', enum: ['name', 'publisher', 'deviceCount'], default: 'name' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const query = softwareCatalogQuerySchema.safeParse(request.query);
      if (!query.success) {
        return validationError(reply, query.error.issues[0]?.message ?? 'Invalid query parameters');
      }

      const { page, limit, search, sortBy, sortOrder } = query.data;

      const [rows, managedApps] = await Promise.all([
        app.prisma.deviceSoftware.findMany({
          where: { device: deviceScope(jwtUser) },
          select: { deviceId: true, name: true, version: true, publisher: true },
          orderBy: { name: 'asc' },
          take: MAX_ROWS,
        }) as unknown as Promise<SoftwareRow[]>,
        app.prisma.application.findMany({
          where:
            jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId },
          select: { id: true, name: true, installerUrl: true },
        }),
      ]);

      const managedByName = new Map(
        managedApps.map((row) => [row.name.trim().toLowerCase(), row])
      );

      const buckets = new Map<string, AggState>();
      for (const row of rows) {
        const key = `${row.name.trim().toLowerCase()}::${row.publisher.trim().toLowerCase()}`;
        let item = buckets.get(key);
        if (!item) {
          item = {
            name: row.name.trim(),
            publisher: row.publisher.trim(),
            deviceCount: 0,
            versions: [],
            latestVersion: row.version,
            seenDevices: new Set<string>(),
            seenVersions: new Set<string>(),
          };
          buckets.set(key, item);
        }
        if (!item.seenDevices.has(row.deviceId)) {
          item.seenDevices.add(row.deviceId);
          item.deviceCount += 1;
        }
        if (!item.seenVersions.has(row.version)) {
          item.seenVersions.add(row.version);
          item.versions.push({ version: row.version, count: 1 });
        } else {
          const bucket = item.versions.find((entry) => entry.version === row.version);
          if (bucket) bucket.count += 1;
        }
      }

      let items: CatalogItem[] = Array.from(buckets.values()).map((state) => {
        const managed = managedByName.get(state.name.toLowerCase());
        return {
          id: managed?.id ?? `${state.name}::${state.publisher}`,
          name: state.name,
          publisher: state.publisher,
          deviceCount: state.deviceCount,
          versions: state.versions,
          latestVersion: state.versions[0]?.version ?? '',
          installerUrl: managed?.installerUrl ?? '',
        };
      });

      if (search) {
        const needle = search.toLowerCase();
        items = items.filter(
          (item) => item.name.toLowerCase().includes(needle) || item.publisher.toLowerCase().includes(needle)
        );
      }

      items.forEach((item) => {
        item.latestVersion = item.versions.sort((a, b) => countCompare(b.version, a.version))[0]?.version ?? '';
      });

      const total = items.length;
      items.sort((a, b) => {
        const aVal = sortBy === 'name' ? a.name : sortBy === 'publisher' ? a.publisher : a.deviceCount;
        const bVal = sortBy === 'name' ? b.name : sortBy === 'publisher' ? b.publisher : b.deviceCount;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortOrder === 'asc' ? cmp : -cmp;
      });

      const paginated = items.slice((page - 1) * limit, page * limit);

      return reply.send({
        success: true,
        data: {
          items: paginated,
          total,
          page,
          limit,
        },
      });
    },
  });

  // ─── Deployment history ─────────────────────────────────────────────────────
  app.get('/deployments', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'List software deployments with the application, device and requester they belong to',
      tags: ['Software Catalog'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'] },
          action: { type: 'string', enum: ['INSTALL', 'UNINSTALL'] },
          applicationId: { type: 'string', format: 'uuid' },
          deviceId: { type: 'string', format: 'uuid' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const query = softwareDeploymentsQuerySchema.safeParse(request.query);

      if (!query.success) {
        return validationError(reply, query.error.issues[0]?.message ?? 'Invalid query parameters');
      }

      const { page, limit, status, action, applicationId, deviceId } = query.data;
      const where: Prisma.DeploymentWhereInput = {
        ...orgScope(jwtUser),
        ...(status ? { status } : {}),
        ...(action ? { action } : {}),
        ...(applicationId ? { applicationId } : {}),
        ...(deviceId ? { deviceId } : {}),
      };

      const [total, items, statusGroups] = await Promise.all([
        app.prisma.deployment.count({ where }),
        app.prisma.deployment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            application: {
              select: { id: true, name: true, version: true, publisher: true, installerUrl: true },
            },
            device: { select: { id: true, deviceName: true, hostname: true, status: true } },
            requester: { select: { id: true, name: true, email: true } },
          },
        }),
        app.prisma.deployment.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
      ]);

      const countFor = (key: string): number =>
        statusGroups.find((row) => row.status === key)?._count._all ?? 0;

      return reply.send({
        success: true,
        data: {
          items: items.map((deployment) => ({
            ...deploymentDetails(deployment),
            application: deployment.application,
            device: deployment.device,
            requester: deployment.requester,
          })),
          total,
          page,
          limit,
          summary: {
            total,
            pending: countFor('PENDING'),
            completed: countFor('COMPLETED'),
            failed: countFor('FAILED'),
            cancelled: countFor('CANCELLED'),
          },
        },
      });
    },
  });

  // ─── Create a deployment (IT Admin+) ────────────────────────────────────────
  app.post('/deploy', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description:
        'Queue an INSTALL_APPLICATION or UNINSTALL_APPLICATION command on a device or every device in a group. Requires confirmed: true',
      tags: ['Software Catalog'],
      body: {
        type: 'object',
        required: ['name', 'targetType', 'targetId'],
        additionalProperties: true,
        properties: {
          applicationId: { type: 'string', format: 'uuid' },
          name: { type: 'string', minLength: 1, maxLength: 255 },
          version: { type: 'string', minLength: 1, maxLength: 64, default: '1.0.0' },
          publisher: { type: 'string', maxLength: 255 },
          installerUrl: { type: 'string', maxLength: 2048 },
          silentArgs: { type: 'string', maxLength: 512 },
          targetType: { type: 'string', enum: ['DEVICE', 'GROUP'] },
          targetId: { type: 'string', format: 'uuid' },
          action: { type: 'string', enum: ['INSTALL', 'UNINSTALL'], default: 'INSTALL' },
          confirmed: { type: 'boolean', default: false },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const body = softwareDeploySchema.safeParse(request.body);

      if (!body.success) {
        return validationError(reply, body.error.issues[0]?.message ?? 'Invalid deployment payload');
      }

      const input = body.data;
      const commandType =
        input.action === 'INSTALL' ? 'INSTALL_APPLICATION' : 'UNINSTALL_APPLICATION';

      // ── Resolve the target device set ──────────────────────────────────────
      let targets: ResolvedTarget[];

      if (input.targetType === 'DEVICE') {
        const device = await app.prisma.device.findFirst({
          where: { id: input.targetId, ...deviceScope(jwtUser) },
          select: { id: true, deviceName: true, organizationId: true },
        });
        if (!device) {
          return notFound(reply, 'Device not found in your organization');
        }
        targets = [device];
      } else {
        const group = await app.prisma.deviceGroup.findFirst({
          where: {
            id: input.targetId,
            ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
          },
          select: { id: true, name: true },
        });
        if (!group) {
          return notFound(reply, 'Device group not found in your organization');
        }

        const members = await app.prisma.deviceGroupMember.findMany({
          where: { groupId: group.id },
          select: { deviceId: true },
        });
        const memberIds = members.map((member) => member.deviceId);
        if (memberIds.length === 0) {
          return validationError(reply, `Device group "${group.name}" has no devices`);
        }
        targets = await app.prisma.device.findMany({
          where: { id: { in: memberIds } },
          select: { id: true, deviceName: true, organizationId: true },
        });
      }

      // ── Resolve (or create) the managed application, once per organization ──
      const orgIds = [...new Set(targets.map((target) => target.organizationId))];
      const applicationByOrg = new Map<string, ManagedApplication>();

      for (const organizationId of orgIds) {
        let application = null;

        if (input.applicationId) {
          application = await app.prisma.application.findFirst({
            where: { id: input.applicationId, organizationId },
          });
          if (!application) {
            return notFound(reply, 'Application not found in the target organization');
          }
        } else {
          application = await app.prisma.application.findFirst({
            where: {
              organizationId,
              name: { equals: input.name, mode: 'insensitive' },
            },
          });
        }

        if (input.action === 'INSTALL') {
          const installerUrl = input.installerUrl?.trim() || application?.installerUrl || '';
          if (!installerUrl) {
            return validationError(
              reply,
              `installerUrl is required to install ${input.name}. Provide a direct http(s) link to the package.`
            );
          }
          application = application
            ? await app.prisma.application.update({
                where: { id: application.id },
                data: {
                  version: input.version,
                  publisher: input.publisher?.trim() || application.publisher,
                  installerUrl,
                  isActive: true,
                },
              })
            : await app.prisma.application.create({
                data: {
                  organizationId,
                  name: input.name.trim(),
                  version: input.version,
                  publisher: input.publisher?.trim() ?? '',
                  installerUrl,
                },
              });
        } else if (!application) {
          application = await app.prisma.application.create({
            data: {
              organizationId,
              name: input.name.trim(),
              version: input.version,
              publisher: input.publisher?.trim() ?? '',
              installerUrl: input.installerUrl?.trim() ?? '',
            },
          });
        }

        applicationByOrg.set(organizationId, application);
      }

      // ── Skip devices that already have this application action in flight ───
      const applicationIds = [...new Set([...applicationByOrg.values()].map((row) => row.id))];
      const activeCommands = await app.prisma.command.findMany({
        where: {
          deviceId: { in: targets.map((target) => target.id) },
          type: commandType,
          status: { in: ACTIVE_COMMAND_STATUSES },
          deployment: { applicationId: { in: applicationIds } },
        },
        select: { deviceId: true },
      });
      const inFlightIds = new Set(activeCommands.map((command) => command.deviceId));
      const queued = targets.filter((target) => !inFlightIds.has(target.id));

      if (queued.length === 0) {
        await writeAudit(app.prisma, jwtUser, 'SOFTWARE_DEPLOY_REQUESTED', 'APPLICATION', applicationIds[0] ?? input.name, {
          action: input.action,
          name: input.name,
          queued: 0,
          skippedInFlight: inFlightIds.size,
          targetType: input.targetType,
          targetId: input.targetId,
        }, request);

        return reply.status(201).send({
          success: true,
          data: {
            deploymentId: null,
            status: 'PENDING',
            action: input.action,
            deployments: [],
            deploymentIds: [],
            queued: 0,
            skippedInFlight: inFlightIds.size,
            deviceIds: [],
            applications: [...applicationByOrg.values()],
            message: 'Every target device already has this action in flight',
          },
        });
      }

      const commandParams: Record<string, unknown> = {
        name: input.name.trim(),
        version: input.version,
        ...(input.silentArgs?.trim() ? { silentArgs: input.silentArgs.trim() } : {}),
        ...(input.publisher?.trim() ? { publisher: input.publisher.trim() } : {}),
      };

      const created = await app.prisma.$transaction(async (tx) => {
        const rows: Array<{ id: string; deviceId: string; applicationId: string }> = [];

        for (const target of queued) {
          const application = applicationByOrg.get(target.organizationId)!;
          const deployment = await tx.deployment.create({
            data: {
              organizationId: target.organizationId,
              applicationId: application.id,
              deviceId: target.id,
              action: input.action,
              status: 'PENDING',
              requestedBy: jwtUser.sub,
            },
          });

          await tx.command.create({
            data: {
              organizationId: target.organizationId,
              deviceId: target.id,
              type: commandType,
              status: 'QUEUED',
              requestedBy: jwtUser.sub,
              deploymentId: deployment.id,
              result: JSON.stringify({
                ...commandParams,
                ...(input.action === 'INSTALL' ? { installerUrl: application.installerUrl } : {}),
                deploymentId: deployment.id,
                applicationId: application.id,
              }),
            },
          });

          rows.push({
            id: deployment.id,
            deviceId: target.id,
            applicationId: application.id,
          });
        }

        return rows;
      });

      await writeAudit(
        app.prisma,
        jwtUser,
        'SOFTWARE_DEPLOY_REQUESTED',
        'APPLICATION',
        applicationIds[0] ?? input.name,
        {
          action: input.action,
          name: input.name,
          version: input.version,
          queued: created.length,
          skippedInFlight: inFlightIds.size,
          targetType: input.targetType,
          targetId: input.targetId,
          deviceIds: created.map((row) => row.deviceId),
        },
        request
      );

      return reply.status(201).send({
        success: true,
        data: {
          deploymentId: created[0]?.id ?? null,
          status: 'PENDING',
          action: input.action,
          deployments: created,
          deploymentIds: created.map((row) => row.id),
          queued: created.length,
          skippedInFlight: inFlightIds.size,
          deviceIds: created.map((row) => row.deviceId),
          applications: [...applicationByOrg.values()],
        },
      });
    },
  });
}
