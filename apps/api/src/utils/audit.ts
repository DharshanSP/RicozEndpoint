import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { JwtPayload } from '../middleware/rbac.middleware';

export function writeAudit(
  prisma: PrismaClient,
  jwtUser: JwtPayload,
  action: string,
  resource: string,
  resourceId: string,
  metadata: Record<string, unknown>,
  request: FastifyRequest
) {
  return prisma.auditLog.create({
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
}

export function requestOrgId(jwtUser: JwtPayload): string {
  return jwtUser.organizationId;
}