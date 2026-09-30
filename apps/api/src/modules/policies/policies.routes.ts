import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  requireMinRole,
  JwtPayload,
} from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import {
  createPolicySchema,
  updatePolicySchema,
  policyParamsSchema,
  policyAssignSchema,
  policyListQuerySchema,
  CreatePolicyInput,
  UpdatePolicyInput,
  PolicyAssignInput,
} from '@ricoz/validation';

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function parseSettings(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function policyDetails(policy: {
  id: string;
  name: string;
  type: string;
  description: string;
  settings: string;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { assignments: number };
  assignments?: Array<{
    id: string;
    deviceId: string | null;
    groupId: string | null;
    priority: number;
    device?: { id: string; deviceName: string; hostname: string } | null;
    group?: { id: string; name: string } | null;
  }>;
}): Record<string, unknown> {
  return {
    id: policy.id,
    name: policy.name,
    type: policy.type,
    description: policy.description,
    settings: parseSettings(policy.settings),
    isActive: policy.isActive,
    createdById: policy.createdById,
    createdAt: toIso(policy.createdAt),
    updatedAt: toIso(policy.updatedAt),
    assignmentsCount: policy._count?.assignments,
    assignments: policy.assignments?.map((assignment) => ({
      id: assignment.id,
      deviceId: assignment.deviceId,
      groupId: assignment.groupId,
      priority: assignment.priority,
      device: assignment.device,
      group: assignment.group,
    })),
  };
}

export async function policiesRoutes(app: FastifyInstance): Promise<void> {
  const orgFilter = (jwtUser: JwtPayload, extra: Prisma.PolicyWhereInput = {}) =>
    jwtUser.role === 'SUPER_ADMIN'
      ? extra
      : { ...extra, organizationId: jwtUser.organizationId };

  const policyBelongsToOrg = async (jwtUser: JwtPayload, id: string) => {
    const policy = await app.prisma.policy.findFirst({
      where: orgFilter(jwtUser, { id }),
      select: { id: true, organizationId: true },
    });
    return policy;
  };

  const writeAudit = (
    jwtUser: JwtPayload,
    action: string,
    resource: string,
    resourceId: string,
    metadata: Record<string, unknown>,
    request: FastifyRequest
  ) => {
    return app.prisma.auditLog.create({
      data: {
        organizationId: jwtUser.organizationId,
        actorId: jwtUser.sub,
        action,
        resource,
        resourceId,
        ipAddress: request.ip,
        metadata: JSON.stringify(metadata),
      },
    });
  };

  // ─── List policies ─────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'List policies with optional filtering by type and status',
      tags: ['Policies'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          type: { type: 'string', enum: ['SECURITY', 'CONFIGURATION', 'COMPLIANCE'] },
          isActive: { type: 'string', enum: ['true', 'false'] },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const query = policyListQuerySchema.safeParse(request.query);

      if (!query.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: query.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { page, limit, search, type, isActive, includeAssignments } = query.data;

      const where: Prisma.PolicyWhereInput = {
        ...orgFilter(jwtUser),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        ...(type ? { type } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      };

      const [total, policies] = await Promise.all([
        app.prisma.policy.count({ where }),
        app.prisma.policy.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: includeAssignments
            ? {
                _count: { select: { assignments: true } },
                assignments: {
                  include: {
                    device: { select: { id: true, deviceName: true, hostname: true } },
                    group: { select: { id: true, name: true } },
                  },
                },
              }
            : { _count: { select: { assignments: true } } },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          items: policies.map(policyDetails),
          total,
          page,
          limit,
        },
      });
    },
  });

  // ─── Get policy by id ──────────────────────────────────────────────────────
  app.get('/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get a single policy with its assignments',
      tags: ['Policies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = policyParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid policy id',
          },
        });
      }

      const policy = await app.prisma.policy.findFirst({
        where: orgFilter(jwtUser, { id: params.data.id }),
        include: {
          _count: { select: { assignments: true } },
          assignments: {
            include: {
              device: { select: { id: true, deviceName: true, hostname: true, os: true, osVersion: true } },
              group: { select: { id: true, name: true, description: true } },
            },
          },
        },
      });

      if (!policy) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Policy not found' },
        });
      }

      return reply.send({ success: true, data: policyDetails(policy) });
    },
  });

  // ─── Create policy ─────────────────────────────────────────────────────────
  app.post('/', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Create a new policy with type-specific settings',
      tags: ['Policies'],
      body: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          type: { type: 'string', enum: ['SECURITY', 'CONFIGURATION', 'COMPLIANCE'] },
          description: { type: 'string', maxLength: 1000 },
          settings: { type: 'object', additionalProperties: true },
          isActive: { type: 'boolean' },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const body = createPolicySchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid policy payload',
            details: body.error.issues,
          },
        });
      }

      const input = body.data as CreatePolicyInput;

      const policy = await app.prisma.policy.create({
        data: {
          organizationId: jwtUser.organizationId,
          name: input.name,
          type: input.type,
          description: input.description ?? '',
          settings: JSON.stringify(input.settings),
          isActive: input.isActive ?? true,
          createdById: jwtUser.sub,
        },
      });

      await writeAudit(jwtUser, 'POLICY_CREATED', 'POLICY', policy.id, { name: policy.name, type: policy.type }, request);

      return reply.status(201).send({ success: true, data: policyDetails(policy) });
    },
  });

  // ─── Update policy ─────────────────────────────────────────────────────────
  app.put('/:id', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Update policy name, description, settings or active state',
      tags: ['Policies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          type: { type: 'string', enum: ['SECURITY', 'CONFIGURATION', 'COMPLIANCE'] },
          description: { type: 'string', maxLength: 1000 },
          settings: { type: 'object', additionalProperties: true },
          isActive: { type: 'boolean' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = policyParamsSchema.safeParse(request.params);
      const body = updatePolicySchema.safeParse(request.body);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid policy id',
          },
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid policy payload',
            details: body.error.issues,
          },
        });
      }

      const policy = await policyBelongsToOrg(jwtUser, params.data.id);
      if (!policy) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Policy not found' },
        });
      }

      const input = body.data as UpdatePolicyInput;
      const updated = await app.prisma.policy.update({
        where: { id: policy.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.type ? { type: input.type } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.settings ? { settings: JSON.stringify(input.settings) } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });

      await writeAudit(jwtUser, 'POLICY_UPDATED', 'POLICY', updated.id, { name: updated.name }, request);

      return reply.send({ success: true, data: policyDetails(updated) });
    },
  });

  // ─── Delete policy ─────────────────────────────────────────────────────────
  app.delete('/:id', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Delete a policy (cascades to assignments)',
      tags: ['Policies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = policyParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid policy id',
          },
        });
      }

      const policy = await policyBelongsToOrg(jwtUser, params.data.id);
      if (!policy) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Policy not found' },
        });
      }

      await app.prisma.policy.delete({ where: { id: policy.id } });
      await writeAudit(jwtUser, 'POLICY_DELETED', 'POLICY', policy.id, {}, request);

      return reply.send({ success: true, data: { id: policy.id, deleted: true } });
    },
  });

  // ─── Assign/unassign policy to devices or groups ───────────────────────────
  app.post('/:id/assign', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Assign a policy to specific devices and/or device groups; supports removal',
      tags: ['Policies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          deviceIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          groupIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          priority: { type: 'integer', minimum: 0, maximum: 1000, default: 100 },
          removeAssignment: { type: 'boolean', default: false },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = policyParamsSchema.safeParse(request.params);
      const body = policyAssignSchema.safeParse(request.body);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid policy id',
          },
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid assignment payload',
            details: body.error.issues,
          },
        });
      }

      const policy = await policyBelongsToOrg(jwtUser, params.data.id);
      if (!policy) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Policy not found' },
        });
      }

      const input = body.data as PolicyAssignInput;
      const { deviceIds, groupIds, priority, removeAssignment } = input;

      if (deviceIds.length === 0 && groupIds.length === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Provide at least one deviceId or groupId',
          },
        });
      }

      // Validate the target devices/groups belong to the policy's own organization.
      const [orgDevices, orgGroups, existingAssignments] = await Promise.all([
        app.prisma.device.count({
          where: { id: { in: deviceIds }, organizationId: policy.organizationId },
        }),
        app.prisma.deviceGroup.count({
          where: { id: { in: groupIds }, organizationId: policy.organizationId },
        }),
        app.prisma.policyAssignment.findMany({
          where: {
            policyId: policy.id,
            OR: [{ deviceId: { in: deviceIds } }, { groupId: { in: groupIds } }],
          },
          select: { id: true, deviceId: true, groupId: true },
        }),
      ]);

      if (orgDevices !== deviceIds.length || orgGroups !== groupIds.length) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'One or more target devices/groups do not belong to this policy organization',
          },
        });
      }

      if (removeAssignment) {
        const toRemove = existingAssignments.filter(
          (a) =>
            (a.deviceId && deviceIds.includes(a.deviceId)) ||
            (a.groupId && groupIds.includes(a.groupId))
        );

        if (toRemove.length > 0) {
          await app.prisma.policyAssignment.deleteMany({
            where: { id: { in: toRemove.map((a) => a.id) } },
          });
        }

        await writeAudit(
          jwtUser,
          'POLICY_UNASSIGNED',
          'POLICY',
          policy.id,
          { removedDevices: deviceIds, removedGroups: groupIds },
          request
        );

        return reply.send({
          success: true,
          data: { removedAssignments: toRemove.map((a) => a.id) },
        });
      }

      // Add missing assignments (dedup by device/group via unique connect).
      const existingTargetIds = new Set(
        existingAssignments.flatMap((a) => [a.deviceId, a.groupId].filter((v): v is string => !!v))
      );

      const toCreate: Prisma.PolicyAssignmentCreateManyInput[] = [];
      for (const deviceId of deviceIds) {
        if (!existingTargetIds.has(deviceId)) {
          toCreate.push({ policyId: policy.id, deviceId, priority });
        }
      }
      for (const groupId of groupIds) {
        if (!existingTargetIds.has(groupId)) {
          toCreate.push({ policyId: policy.id, groupId, priority });
        }
      }

      if (toCreate.length > 0) {
        await app.prisma.policyAssignment.createMany({ data: toCreate });
      } else {
        reply.status(409);
        return reply.send({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Device(s)/group(s) are already assigned to this policy',
          },
        });
      }

      await writeAudit(
        jwtUser,
        'POLICY_ASSIGNED',
        'POLICY',
        policy.id,
        { addedDevices: deviceIds, addedGroups: groupIds, priority },
        request
      );

      return reply.send({ success: true, data: { assigned: toCreate.length } });
    },
  });
}