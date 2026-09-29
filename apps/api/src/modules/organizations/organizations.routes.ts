import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { authenticate, requireRole, JwtPayload } from '../../middleware/rbac.middleware';
import { hashPassword } from '../../utils/password';
import { writeAudit } from '../../utils/audit';
import { UserRole } from '@ricoz/shared-types';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationListQuerySchema,
} from '@ricoz/validation';

/**
 * Organization management.
 *
 * Only SUPER_ADMIN may create or modify organizations. Every other role reads
 * organization data through /api/settings and /api/auth/me, which are scoped to
 * the caller's own organization.
 */
export async function organizationsRoutes(app: FastifyInstance): Promise<void> {
  // ─── List organizations ─────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [authenticate, requireRole([UserRole.SUPER_ADMIN])],
    schema: {
      description: 'List all organizations with fleet and user counts',
      tags: ['Organizations'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = organizationListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { page, limit, search } = parsed.data;

      const where: Prisma.OrganizationWhereInput = search
        ? { name: { contains: search, mode: 'insensitive' } }
        : {};

      const [total, organizations] = await Promise.all([
        app.prisma.organization.count({ where }),
        app.prisma.organization.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            createdAt: true,
            _count: { select: { devices: true, users: true } },
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: organizations.map((org) => ({
          id: org.id,
          name: org.name,
          deviceCount: org._count.devices,
          userCount: org._count.users,
          createdAt: org.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  });

  // ─── Create organization (+ optional bootstrap admin) ───────────────────────
  app.post('/', {
    preHandler: [authenticate, requireRole([UserRole.SUPER_ADMIN])],
    schema: {
      description: 'Create a new tenant organization and optionally its first administrator',
      tags: ['Organizations'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const parsed = createOrganizationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid organization payload',
          },
        });
      }

      const { name, admin } = parsed.data;

      const existing = await app.prisma.organization.findUnique({ where: { name } });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'An organization with this name already exists',
          },
        });
      }

      const organization = await app.prisma.organization.create({
        data: {
          name,
          users: admin
            ? {
                create: {
                  email: admin.email.toLowerCase(),
                  name: admin.name,
                  passwordHash: await hashPassword(admin.password),
                  role: UserRole.ORG_ADMIN,
                },
              }
            : undefined,
        },
        select: { id: true, name: true, createdAt: true },
      });

      await writeAudit(
        app.prisma,
        jwtUser,
        'ORGANIZATION_CREATED',
        'ORGANIZATION',
        organization.id,
        { name: organization.name, bootstrapAdmin: Boolean(admin) },
        request
      );

      return reply.status(201).send({
        success: true,
        data: {
          id: organization.id,
          name: organization.name,
          createdAt: organization.createdAt.toISOString(),
        },
      });
    },
  });

  // ─── Update organization ────────────────────────────────────────────────────
  app.patch('/:id', {
    preHandler: [authenticate, requireRole([UserRole.SUPER_ADMIN])],
    schema: {
      description: 'Rename an organization or update its settings payload',
      tags: ['Organizations'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const parsed = updateOrganizationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid organization payload',
          },
        });
      }

      const organization = await app.prisma.organization.findUnique({ where: { id } });
      if (!organization) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        });
      }

      const updated = await app.prisma.organization.update({
        where: { id },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          ...(parsed.data.settingsJson
            ? { settingsJson: parsed.data.settingsJson as Prisma.InputJsonValue }
            : {}),
        },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });

      await writeAudit(app.prisma, jwtUser, 'ORGANIZATION_UPDATED', 'ORGANIZATION', id, {
        name: updated.name,
      }, request);

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    },
  });
}
