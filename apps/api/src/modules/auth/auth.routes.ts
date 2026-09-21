import type { FastifyInstance } from 'fastify';
import { verifyPassword } from '../../utils/password';
import { authenticate, JwtPayload } from '../../middleware/rbac.middleware';

export async function authRoutes(app: FastifyInstance): Promise<void> {
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

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organization.name,
          createdAt: user.createdAt,
        },
      });
    },
  });
}
