import type { FastifyInstance } from 'fastify';
import { verifyPassword, hashPassword } from '../../utils/password';
import { authenticate, JwtPayload } from '../../middleware/rbac.middleware';
import { writeAudit } from '../../utils/audit';
import { changePasswordSchema, registerSchema } from '@ricoz/validation';
import { getConfig } from '../../config';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ─── Public tenant signup ─────────────────────────────────────────────────
  // Creates a brand-new organization with the registrant in a basic workspace
  // role (OPERATOR or VIEWER only). IT_ADMIN and administrative roles are
  // never self-granted. Disable in production with
  // ALLOW_PUBLIC_SIGNUP=false.
  app.post('/register', {
    schema: {
      description: 'Register a new organization with an initial workspace account (role: OPERATOR or VIEWER)',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['organizationName', 'name', 'email', 'password'],
        properties: {
          organizationName: { type: 'string', minLength: 2, maxLength: 120 },
          name: { type: 'string', minLength: 2, maxLength: 120 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, maxLength: 128 },
          role: { type: 'string', enum: ['OPERATOR', 'VIEWER'] },
        },
      },
    },
    handler: async (request, reply) => {
      if (!getConfig().ALLOW_PUBLIC_SIGNUP) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'REGISTRATION_DISABLED',
            message: 'Public registration is disabled. Contact your administrator for access.',
          },
        });
      }

      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid registration payload',
          },
        });
      }

      const { organizationName, name, email, password, role } = parsed.data;
      const normalizedEmail = email.toLowerCase();

      const [existingUser, existingOrg] = await Promise.all([
        app.prisma.user.findUnique({ where: { email: normalizedEmail } }),
        app.prisma.organization.findFirst({
          where: { name: { equals: organizationName.trim(), mode: 'insensitive' } },
        }),
      ]);

      if (existingUser) {
        return reply.status(409).send({
          success: false,
          error: { code: 'USER_EXISTS', message: 'An account with this email already exists' },
        });
      }

      if (existingOrg) {
        return reply.status(409).send({
          success: false,
          error: { code: 'ORG_EXISTS', message: 'An organization with this name already exists' },
        });
      }

      const passwordHash = await hashPassword(password);
      const organization = await app.prisma.organization.create({
        data: { name: organizationName.trim() },
      });
      const user = await app.prisma.user.create({
        data: {
          organizationId: organization.id,
          email: normalizedEmail,
          name: name.trim(),
          passwordHash,
          role,
        },
      });

      await app.prisma.auditLog
        .create({
          data: {
            organizationId: organization.id,
            actorId: user.id,
            action: 'ORG_REGISTERED',
            resource: 'ORGANIZATION',
            resourceId: organization.id,
            ipAddress: request.ip,
            metadata: JSON.stringify({ email: user.email, organizationName: organization.name, role }),
          },
        })
        .catch(() => undefined);

      const token = app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: organization.id,
      });

      return reply.status(201).send({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: organization.id,
            organizationName: organization.name,
            isDemoAccount: user.isDemoAccount,
          },
        },
      });
    },
  });

  app.post('/login', {
    schema: {
      description: 'Authenticate user and return JWT access token',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
    },
    handler: async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };

      // Query database for user
      const user = await app.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { organization: true },
      });

      if (!user || !user.isActive) {
        // Best-effort failed-login audit when the account exists but is disabled.
        // Unknown emails are not logged (no organization scope to attach to).
        if (user) {
          await app.prisma.auditLog.create({
            data: {
              organizationId: user.organizationId,
              actorId: user.id,
              action: 'LOGIN_FAILED',
              resource: 'AUTH',
              resourceId: user.id,
              ipAddress: request.ip,
              metadata: JSON.stringify({ email: email.toLowerCase(), reason: 'inactive' }),
            },
          }).catch(() => undefined);
        }
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
      }

      // Verify password hash
      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        await app.prisma.auditLog.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: 'LOGIN_FAILED',
            resource: 'AUTH',
            resourceId: user.id,
            ipAddress: request.ip,
            metadata: JSON.stringify({ email: email.toLowerCase(), reason: 'bad_password' }),
          },
        }).catch(() => undefined);
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
      }

      // Generate JWT token
      const token = app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      await app.prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorId: user.id,
          action: 'LOGIN_SUCCESS',
          resource: 'AUTH',
          resourceId: user.id,
          ipAddress: request.ip,
          metadata: JSON.stringify({ email: user.email, role: user.role }),
        },
      }).catch(() => undefined);

      return reply.send({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            organizationName: user.organization.name,
            isDemoAccount: user.isDemoAccount,
          },
        },
      });
    },
  });

  app.get('/me', {
    preHandler: [authenticate],
    schema: {
      description: 'Get current logged in user profile',
      tags: ['Auth'],
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;

      const user = await app.prisma.user.findUnique({
        where: { id: jwtUser.sub },
        include: { organization: true },
      });

      if (!user || !user.isActive) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User account is inactive or not found' },
        });
      }

      // The token carries the *active* organization, which may differ from the
      // user's home organization after a super-admin tenant switch. Prefer the
      // token scope so the client keeps rendering the tenant it selected.
      const activeOrganizationId = jwtUser.organizationId;
      const activeOrganization =
        activeOrganizationId === user.organizationId
          ? user.organization
          : await app.prisma.organization.findUnique({
              where: { id: activeOrganizationId },
              select: { id: true, name: true },
            });

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: activeOrganizationId,
          organizationName: activeOrganization?.name ?? user.organization.name,
          homeOrganizationId: user.organizationId,
          isDemoAccount: user.isDemoAccount,
          createdAt: user.createdAt,
        },
      });
    },
  });

  // ─── Self-service password change ──────────────────────────────────────────
  app.post('/change-password', {
    preHandler: [authenticate],
    schema: {
      description: 'Change the authenticated user password by verifying the current one',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const parsed = changePasswordSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid password payload',
          },
        });
      }

      const { currentPassword, newPassword } = parsed.data;

      const user = await app.prisma.user.findUnique({ where: { id: jwtUser.sub } });
      if (!user || !user.isActive) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User account is inactive or not found' },
        });
      }

      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Current password is incorrect',
          },
        });
      }

      const passwordHash = await hashPassword(newPassword);
      await app.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await writeAudit(app.prisma, jwtUser, 'PASSWORD_CHANGED', 'USER', user.id, {}, request);

      // Issue a fresh token so the current session continues without re-login.
      const token = app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      return reply.send({
        success: true,
        data: { token, changedAt: new Date().toISOString() },
      });
    },
  });

  // ─── Refresh an existing session token ──────────────────────────────────────
  app.post('/refresh', {
    preHandler: [authenticate],
    schema: {
      description: 'Exchange a valid (near-expiry) session token for a freshly signed one',
      tags: ['Auth'],
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;

      const user = await app.prisma.user.findUnique({ where: { id: jwtUser.sub } });
      if (!user || !user.isActive) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User account is inactive or not found' },
        });
      }

      const token = app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      await writeAudit(app.prisma, jwtUser, 'TOKEN_REFRESHED', 'AUTH', user.id, {}, request).catch(
        () => undefined
      );

      return reply.send({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            isDemoAccount: user.isDemoAccount,
          },
        },
      });
    },
  });

  // ─── Logout (stateless JWT: client discards token; recorded for history) ───
  app.post('/logout', {
    preHandler: [authenticate],
    schema: {
      description: 'Record a logout event for the current session',
      tags: ['Auth'],
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      await writeAudit(app.prisma, jwtUser, 'LOGOUT', 'AUTH', jwtUser.sub, {}, request).catch(
        () => undefined
      );
      return reply.send({ success: true, data: { loggedOutAt: new Date().toISOString() } });
    },
  });

  // ─── Switch active organization (tenant) ────────────────────────────────────
  app.post('/switch-organization', {
    preHandler: [authenticate],
    schema: {
      description:
        'Re-issue the session token scoped to another organization. SUPER_ADMIN may target any tenant; all other roles are restricted to their own organization.',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['organizationId'],
        properties: { organizationId: { type: 'string', format: 'uuid' } },
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { organizationId } = request.body as { organizationId: string };

      // Non super-admins may only re-scope to the organization they already belong to.
      if (jwtUser.role !== 'SUPER_ADMIN' && organizationId !== jwtUser.organizationId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only a super administrator may switch to another organization',
          },
        });
      }

      const organization = await app.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      });

      if (!organization) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        });
      }

      const token = app.jwt.sign({
        sub: jwtUser.sub,
        email: jwtUser.email,
        role: jwtUser.role,
        organizationId: organization.id,
      });

      await writeAudit(
        app.prisma,
        { ...jwtUser, organizationId: organization.id } as JwtPayload,
        'ORG_SWITCHED',
        'ORGANIZATION',
        organization.id,
        { from: jwtUser.organizationId, to: organization.id },
        request
      ).catch(() => undefined);

      return reply.send({
        success: true,
        data: {
          token,
          organization: { id: organization.id, name: organization.name },
        },
      });
    },
  });
}
