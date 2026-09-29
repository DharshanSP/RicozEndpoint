import type { FastifyInstance } from 'fastify';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { hashPassword } from '../../utils/password';
import { writeAudit } from '../../utils/audit';
import { UserRole } from '@ricoz/shared-types';
import { adminResetPasswordSchema } from '@ricoz/validation';

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
      const { email, name, password, role, organizationId } = request.body as {
        email: string;
        name: string;
        password: string;
        role: UserRole;
        organizationId?: string;
      };

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
      const { name, role, isActive } = request.body as {
        name?: string;
        role?: UserRole;
        isActive?: boolean;
      };

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
}
