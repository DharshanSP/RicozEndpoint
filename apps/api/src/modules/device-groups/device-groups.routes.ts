import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import {
  deviceGroupCreateSchema,
  deviceGroupUpdateSchema,
  deviceGroupParamsSchema,
  deviceGroupListQuerySchema,
  deviceGroupMembersSchema,
  DeviceGroupCreateInput,
  DeviceGroupUpdateInput,
  DeviceGroupMembersInput,
} from '@ricoz/validation';
import { writeAudit } from '../../utils/audit';

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function groupDetails(group: {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { devices?: number; policies?: number };
  devices?: Array<{
    id: string;
    device?: { id: string; deviceName: string; hostname: string; status: string } | null;
  }>;
  policies?: Array<{
    id: string;
    policyId: string;
    priority: number;
    policy?: { id: string; name: string } | null;
  }>;
}): Record<string, unknown> {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    createdAt: toIso(group.createdAt),
    updatedAt: toIso(group.updatedAt),
    membersCount: group._count?.devices ?? group.devices?.length ?? 0,
    policiesCount: group._count?.policies ?? group.policies?.length ?? 0,
    members: group.devices?.map((member) => ({
      id: member.id,
      device: member.device,
    })),
    assignments: group.policies?.map((assignment) => ({
      id: assignment.id,
      policyId: assignment.policyId,
      priority: assignment.priority,
      policy: assignment.policy,
    })),
  };
}

export async function deviceGroupsRoutes(app: FastifyInstance): Promise<void> {
  const orgFilter = (jwtUser: JwtPayload, extra: Prisma.DeviceGroupWhereInput = {}) =>
    jwtUser.role === 'SUPER_ADMIN'
      ? extra
      : { ...extra, organizationId: jwtUser.organizationId };

  const groupBelongsToOrg = async (jwtUser: JwtPayload, id: string) => {
    return app.prisma.deviceGroup.findFirst({
      where: orgFilter(jwtUser, { id }),
      select: { id: true, organizationId: true },
    });
  };

  const validateDevicesBelongToOrg = async (jwtUser: JwtPayload, deviceIds: string[]) => {
    const counted = await app.prisma.device.count({
      where: { id: { in: deviceIds }, organizationId: jwtUser.organizationId },
    });
    return counted === deviceIds.length;
  };

  // ─── List groups ───────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'List device groups with member and policy counts',
      tags: ['Device Groups'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const query = deviceGroupListQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: query.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { page, limit, search } = query.data;
      const where: Prisma.DeviceGroupWhereInput = {
        ...orgFilter(jwtUser),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [total, groups] = await Promise.all([
        app.prisma.deviceGroup.count({ where }),
        app.prisma.deviceGroup.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            _count: { select: { devices: true, policies: true } },
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          items: groups.map(groupDetails),
          total,
          page,
          limit,
        },
      });
    },
  });

  // ─── Get group detail ──────────────────────────────────────────────────────
  app.get('/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get a device group with its members and policy assignments',
      tags: ['Device Groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = deviceGroupParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid device group id' },
        });
      }

      const group = await app.prisma.deviceGroup.findFirst({
        where: orgFilter(jwtUser, { id: params.data.id }),
        include: {
          devices: {
            include: {
              device: { select: { id: true, deviceName: true, hostname: true, status: true } },
            },
            orderBy: { device: { deviceName: 'asc' } },
          },
          policies: {
            include: { policy: { select: { id: true, name: true } } },
          },
        },
      });

      if (!group) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device group not found' },
        });
      }

      return reply.send({ success: true, data: groupDetails(group) });
    },
  });

  // ─── Create group ──────────────────────────────────────────────────────────
  app.post('/', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Create a device group, optionally with initial member devices',
      tags: ['Device Groups'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 },
          deviceIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const body = deviceGroupCreateSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid payload',
            details: body.error.issues,
          },
        });
      }
      const input = body.data as DeviceGroupCreateInput;

      if (input.deviceIds.length > 0) {
        const orgOk = await validateDevicesBelongToOrg(jwtUser, input.deviceIds);
        if (!orgOk) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'One or more devices do not belong to your organization' },
          });
        }
      }

      const existing = await app.prisma.deviceGroup.findFirst({
        where: orgFilter(jwtUser, { name: input.name }),
        select: { id: true },
      });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'A device group with this name already exists' },
        });
      }

      const group = await app.prisma.deviceGroup.create({
        data: {
          organizationId: jwtUser.organizationId,
          name: input.name,
          description: input.description,
          devices:
            input.deviceIds.length > 0
              ? { create: input.deviceIds.map((deviceId) => ({ deviceId })) }
              : undefined,
        },
      });

      await writeAudit(app.prisma, jwtUser, 'GROUP_CREATED', 'DEVICE_GROUP', group.id, {
        name: group.name,
        memberCount: input.deviceIds.length,
      }, request);

      return reply.status(201).send({ success: true, data: { id: group.id, name: group.name } });
    },
  });

  // ─── Update group ──────────────────────────────────────────────────────────
  app.put('/:id', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Update a device group name or description',
      tags: ['Device Groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = deviceGroupParamsSchema.safeParse(request.params);
      const body = deviceGroupUpdateSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request' },
        });
      }
      const input = body.data as DeviceGroupUpdateInput;

      const group = await groupBelongsToOrg(jwtUser, params.data.id);
      if (!group) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device group not found' },
        });
      }

      if (input.name) {
        const clash = await app.prisma.deviceGroup.findFirst({
          where: orgFilter(jwtUser, { name: input.name, NOT: { id: group.id } }),
          select: { id: true },
        });
        if (clash) {
          return reply.status(409).send({
            success: false,
            error: { code: 'CONFLICT', message: 'A device group with this name already exists' },
          });
        }
      }

      const updated = await app.prisma.deviceGroup.update({
        where: { id: group.id },
        data: { name: input.name, description: input.description },
      });

      await writeAudit(app.prisma, jwtUser, 'GROUP_UPDATED', 'DEVICE_GROUP', updated.id, {}, request);
      return reply.send({ success: true, data: { id: updated.id, name: updated.name } });
    },
  });

  // ─── Delete group ──────────────────────────────────────────────────────────
  app.delete('/:id', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Delete a device group (membership and policy assignments cascade)',
      tags: ['Device Groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = deviceGroupParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid device group id' },
        });
      }

      const group = await groupBelongsToOrg(jwtUser, params.data.id);
      if (!group) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device group not found' },
        });
      }

      await app.prisma.deviceGroup.delete({ where: { id: group.id } });
      await writeAudit(app.prisma, jwtUser, 'GROUP_DELETED', 'DEVICE_GROUP', group.id, {}, request);
      return reply.send({ success: true, data: { id: group.id } });
    },
  });

  // ─── Add members ───────────────────────────────────────────────────────────
  app.post('/:id/members', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Add devices to a device group',
      tags: ['Device Groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['deviceIds'],
        properties: { deviceIds: { type: 'array', items: { type: 'string', format: 'uuid' } } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = deviceGroupParamsSchema.safeParse(request.params);
      const body = deviceGroupMembersSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request' },
        });
      }
      const input = body.data as DeviceGroupMembersInput;

      const group = await groupBelongsToOrg(jwtUser, params.data.id);
      if (!group) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device group not found' },
        });
      }

      const orgOk = await validateDevicesBelongToOrg(jwtUser, input.deviceIds);
      if (!orgOk) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'One or more devices do not belong to your organization' },
        });
      }

      const existingMembers = await app.prisma.deviceGroupMember.findMany({
        where: { groupId: group.id, deviceId: { in: input.deviceIds } },
        select: { deviceId: true },
      });
      const existingIds = new Set(existingMembers.map((member) => member.deviceId));
      const toAdd = input.deviceIds.filter((id) => !existingIds.has(id));

      if (toAdd.length > 0) {
        await app.prisma.deviceGroupMember.createMany({
          data: toAdd.map((deviceId) => ({ groupId: group.id, deviceId })),
          skipDuplicates: true,
        });
      }

      await writeAudit(app.prisma, jwtUser, 'GROUP_MEMBERS_ADDED', 'DEVICE_GROUP', group.id, {
        added: toAdd,
      }, request);

      return reply.send({ success: true, data: { added: toAdd.length, skipped: input.deviceIds.length - toAdd.length } });
    },
  });

  // ─── Remove member ─────────────────────────────────────────────────────────
  app.delete('/:id/members/:deviceId', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Remove a device from a group',
      tags: ['Device Groups'],
      params: {
        type: 'object',
        required: ['id', 'deviceId'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceId: { type: 'string', format: 'uuid' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const group = await groupBelongsToOrg(jwtUser, String((request.params as { id: string }).id));
      if (!group) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Device group not found' },
        });
      }

      const deviceId = String((request.params as { deviceId: string }).deviceId);
      await app.prisma.deviceGroupMember.deleteMany({ where: { groupId: group.id, deviceId } });

      await writeAudit(app.prisma, jwtUser, 'GROUP_MEMBER_REMOVED', 'DEVICE_GROUP', group.id, {
        deviceId,
      }, request);

      return reply.send({ success: true, data: { removed: true } });
    },
  });
}