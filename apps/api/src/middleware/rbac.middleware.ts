import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@ricoz/shared-types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
  /** True for seeded demo login accounts, which only ever see demo devices. */
  isDemoAccount?: boolean;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  ORG_ADMIN: 4,
  IT_ADMIN: 3,
  OPERATOR: 2,
  VIEWER: 1,
};

/**
 * Fastify preHandler middleware to verify JWT authentication.
 *
 * The token itself only proves identity: the account must still exist and be
 * active, otherwise a deactivated user could keep using an unexpired token.
 * The role is re-read from the database on every request so demotions and
 * promotions take effect without forcing a re-login. The active organization
 * stays scoped to the token (SUPER_ADMIN may switch tenants), but a
 * non-SUPER_ADMIN token scoped to a foreign organization is rejected.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is invalid or expired',
      },
    });
  }

  const payload = request.user as JwtPayload | undefined;
  if (!payload?.sub) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication token is invalid or expired' },
    });
  }

  try {
    const user = await request.server.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, role: true, organizationId: true, isDemoAccount: true },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Account is disabled',
        },
      });
    }

    if (user.role !== 'SUPER_ADMIN' && payload.organizationId !== user.organizationId) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session organization does not match account organization',
        },
      });
    }

    // Live role: promotions/demotions apply to in-flight sessions immediately.
    (request.user as JwtPayload).role = user.role as JwtPayload['role'];
    (request.user as JwtPayload).isDemoAccount = user.isDemoAccount ?? false;
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Unable to validate account status' },
    });
  }
}

/**
 * Fastify preHandler hook to enforce minimum required UserRole or allowed roles array.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // First ensure user is authenticated
    if (!request.user) {
      await authenticate(request, reply);
      if (reply.sent) return;
    }

    const user = request.user as JwtPayload;

    if (!user || !user.role) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: missing role claims',
        },
      });
    }

    // SUPER_ADMIN always has access
    if (user.role === 'SUPER_ADMIN') {
      return;
    }

    // Check if user's role is in allowed list
    const hasRole = allowedRoles.includes(user.role);

    if (!hasRole) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Forbidden: role '${user.role}' does not have sufficient permissions for this resource`,
        },
      });
    }
  };
}

/**
 * Fastify preHandler hook to enforce minimum role level in hierarchy.
 */
export function requireMinRole(minRole: UserRole) {
  const minWeight = ROLE_HIERARCHY[minRole] ?? 1;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      await authenticate(request, reply);
      if (reply.sent) return;
    }

    const user = request.user as JwtPayload;
    const userWeight = ROLE_HIERARCHY[user?.role] ?? 0;

    if (userWeight < minWeight) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Forbidden: require minimum role level '${minRole}'`,
        },
      });
    }
  };
}
