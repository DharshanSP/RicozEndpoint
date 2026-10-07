import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { hashPassword } from '../../utils/password';
import { writeAudit } from '../../utils/audit';
import { UserRole } from '@ricoz/shared-types';
import { adminResetPasswordSchema, createUserSchema, updateUserSchema } from '@ricoz/validation';

const ROLE_WEIGHT: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  ORG_ADMIN: 4,
  IT_ADMIN: 3,
  OPERATOR: 2,
  VIEWER: 1,
};

/** Counts active users in an org holding SUPER_ADMIN or ORG_ADMIN. */
async function countActiveOrgAdmins(
  prisma: PrismaClient,
  organizationId: string,
  excludeUserId?: string
): Promise<number> {
  return prisma.user.count({
    where: {
      organizationId,
      isActive: true,
      role: { in: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  // List users in organization
  app.get('/', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'List users in current organization',
      tags: ['Users'],
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;

      const users = await app.prisma.user.findMany({
        where: jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: users,
      });
    },
  });

  // Create new user
  app.post('/', {
    preHandler: [requireMinRole(UserRole.ORG_ADMIN)],
    schema: {
      description: 'Create a new user within the organization',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['email', 'name', 'password', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 2 },
          password: { type: 'string', minLength: 8 },
          role: { type: 'string', enum: ['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN', 'OPERATOR', 'VIEWER'] },
          organizationId: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid user payload',
          },
        });
      }

      const { email, name, password, role, organizationId } = parsed.data;

      // Privilege escalation guard: nobody may mint an account at or above
      // their own level (only SUPER_ADMIN can create ORG_ADMIN/SUPER_ADMIN).
      if (jwtUser.role !== 'SUPER_ADMIN' && ROLE_WEIGHT[role] >= ROLE_WEIGHT[jwtUser.role]) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Forbidden: cannot create a user with role '${role}'`,
          },
        });
      }

      const targetOrgId = jwtUser.role === 'SUPER_ADMIN' && organizationId ? organizationId : jwtUser.organizationId;

      // Check if user email already exists
      const existingUser = await app.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'A user with this email address already exists',
          },
        });
      }

      const passwordHash = await hashPassword(password);

      const newUser = await app.prisma.user.create({
        data: {
          organizationId: targetOrgId,
          email: email.toLowerCase(),
          name,
          passwordHash,
          role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          organizationId: true,
          createdAt: true,
        },
      });

      await writeAudit(
        app.prisma,
        jwtUser,
        'USER_CREATED',
        'USER',
        newUser.id,
        { email: newUser.email, role: newUser.role },
        request
      );

      return reply.status(201).send({
        success: true,
        data: newUser,
      });
    },
  });

  // Update user role or status
  app.patch('/:id', {
    preHandler: [requireMinRole(UserRole.ORG_ADMIN)],
    schema: {
      description: 'Update user role or active status',
      tags: ['Users'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const rawBody = (request.body ?? {}) as Record<string, unknown>;
      if (rawBody.password !== undefined) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password cannot be changed here. Use the reset-password endpoint.',
          },
        });
      }
      const parsed = updateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid update payload',
          },
        });
      }
      const { name, role, isActive } = parsed.data;

      const user = await app.prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      // Enforce organization scoping
      if (jwtUser.role !== 'SUPER_ADMIN' && user.organizationId !== jwtUser.organizationId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot modify user in another organization' },
        });
      }

      if (jwtUser.role !== 'SUPER_ADMIN' && user.role === 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot modify a super administrator' },
        });
      }

      // Privilege escalation guard: no promoting peers/self above own level.
      if (
        jwtUser.role !== 'SUPER_ADMIN' &&
        role !== undefined &&
        ROLE_WEIGHT[role] >= ROLE_WEIGHT[jwtUser.role]
      ) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Forbidden: cannot assign role '${role}'`,
          },
        });
      }

      if (id === jwtUser.sub && isActive === false) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'You cannot deactivate your own account',
          },
        });
      }

      // Last-admin protection: never leave an organization without an active admin.
      const demotesAdmin =
        role !== undefined &&
        (user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN') &&
        role !== 'SUPER_ADMIN' &&
        role !== 'ORG_ADMIN';
      const deactivatesAdmin =
        isActive === false &&
        user.isActive &&
        (user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN');
      if ((demotesAdmin || deactivatesAdmin) && user.organizationId) {
        const remaining = await countActiveOrgAdmins(app.prisma, user.organizationId, user.id);
        if (remaining === 0) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Cannot remove the last active administrator of the organization',
            },
          });
        }
      }

      const changes: Record<string, unknown> = {};
      if (name !== undefined) changes.name = name;
      if (role !== undefined) changes.role = role;
      if (isActive !== undefined) changes.isActive = isActive;

      const updatedUser = await app.prisma.user.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(role ? { role } : {}),
          ...(typeof isActive === 'boolean' ? { isActive } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await writeAudit(
        app.prisma,
        jwtUser,
        role !== undefined && role !== user.role ? 'USER_ROLE_CHANGED' : 'USER_UPDATED',
        'USER',
        updatedUser.id,
        {
          email: updatedUser.email,
          changed: Object.keys(changes),
          ...(role !== undefined && role !== user.role
            ? { previousRole: user.role, newRole: updatedUser.role }
            : {}),
          role: updatedUser.role,
          isActive: updatedUser.isActive,
        },
        request
      );

      return reply.send({
        success: true,
        data: updatedUser,
      });
    },
  });

  // ─── Admin password reset ───────────────────────────────────────────────────
  app.post('/:id/reset-password', {
    preHandler: [requireMinRole(UserRole.ORG_ADMIN)],
    schema: {
      description: 'Administratively reset another user password (user is not asked for their current one)',
      tags: ['Users'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const parsed = adminResetPasswordSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid password payload',
          },
        });
      }

      const target = await app.prisma.user.findUnique({ where: { id } });
      if (!target) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      // Tenant isolation: only SUPER_ADMIN may reset across organizations.
      if (jwtUser.role !== 'SUPER_ADMIN' && target.organizationId !== jwtUser.organizationId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot reset password for a user in another organization' },
        });
      }

      // An org admin cannot escalate by resetting a SUPER_ADMIN.
      if (target.role === 'SUPER_ADMIN' && jwtUser.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot reset password for a super administrator' },
        });
      }

      const passwordHash = await hashPassword(parsed.data.newPassword);
      await app.prisma.user.update({ where: { id }, data: { passwordHash } });

      await writeAudit(
        app.prisma,
        jwtUser,
        'PASSWORD_RESET_BY_ADMIN',
        'USER',
        target.id,
        { email: target.email },
        request
      );

      return reply.send({
        success: true,
        data: { id: target.id, resetAt: new Date().toISOString() },
      });
    },
  });

  // ─── Delete user ────────────────────────────────────────────────────────────
  app.delete('/:id', {
    preHandler: [requireMinRole(UserRole.ORG_ADMIN)],
    schema: {
      description: 'Permanently remove a user. Blocked for self, super admins (unless actor is one), and the last active org admin.',
      tags: ['Users'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const target = await app.prisma.user.findUnique({ where: { id } });
      if (!target) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      if (jwtUser.role !== 'SUPER_ADMIN' && target.organizationId !== jwtUser.organizationId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot remove a user in another organization' },
        });
      }

      if (target.role === 'SUPER_ADMIN' && jwtUser.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot remove a super administrator' },
        });
      }

      if (id === jwtUser.sub) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'You cannot delete your own account' },
        });
      }

      if (
        target.isActive &&
        (target.role === 'SUPER_ADMIN' || target.role === 'ORG_ADMIN')
      ) {
        const remaining = await countActiveOrgAdmins(app.prisma, target.organizationId, target.id);
        if (remaining === 0) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Cannot remove the last active administrator of the organization',
            },
          });
        }
      }

      // Preserve immutable history: detach nullable references before deleting.
      await app.prisma.$transaction([
        app.prisma.auditLog.updateMany({
          where: { actorId: target.id },
          data: { actorId: null },
        }),
        app.prisma.command.updateMany({
          where: { requestedBy: target.id },
          data: { requestedBy: null },
        }),
        app.prisma.deployment.updateMany({
          where: { requestedBy: target.id },
          data: { requestedBy: null },
        }),
        app.prisma.patch.updateMany({
          where: { createdById: target.id },
          data: { createdById: null },
        }),
        app.prisma.enrollmentToken.updateMany({
          where: { createdById: target.id },
          data: { createdById: null },
        }),
        app.prisma.user.delete({ where: { id: target.id } }),
      ]);

      await writeAudit(
        app.prisma,
        jwtUser,
        'USER_DELETED',
        'USER',
        target.id,
        { email: target.email, role: target.role },
        request
      );

      return reply.send({ success: true, data: { id: target.id, email: target.email } });
    },
  });
}
