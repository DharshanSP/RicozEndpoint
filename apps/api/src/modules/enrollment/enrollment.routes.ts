import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@ricoz/shared-types';
import { Prisma } from '@prisma/client';
import { authenticate, requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import {
  createEnrollmentTokenSchema,
  enrollmentTokenListQuerySchema,
  enrollmentParamsSchema,
  enrollDeviceSchema,
} from '@ricoz/validation';
import { generateToken, generateAgentToken, hashToken } from '../../utils/tokens';
import { loadConfig } from '../../config';
import { writeAudit } from '../../utils/audit';

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function enrollmentRoutes(app: FastifyInstance): Promise<void> {
  // ─── Admin: list enrollment tokens ───────────────────────────────────────────
  app.get('/enrollment-tokens', {
    preHandler: [authenticate, requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'List enrollment tokens for the caller organization',
      tags: ['Enrollment'],
      querystring: {
        type: 'object',
        additionalProperties: true,
        properties: {
          page: { type: 'string' },
          limit: { type: 'string' },
          search: { type: 'string' },
          includeRevoked: { type: 'string', enum: ['true', 'false'] },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const parsed = enrollmentTokenListQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { page, limit, search, includeRevoked } = parsed.data;

      const orgFilter: Prisma.EnrollmentTokenWhereInput =
        jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

      const searchFilter: Prisma.EnrollmentTokenWhereInput | undefined = search
        ? { OR: [{ label: { contains: search, mode: 'insensitive' } }] }
        : undefined;

      const where: Prisma.EnrollmentTokenWhereInput = {
        ...orgFilter,
        ...(includeRevoked ? {} : { isActive: true }),
        ...(searchFilter ?? {}),
      };

      const [total, tokens] = await Promise.all([
        app.prisma.enrollmentToken.count({ where }),
        app.prisma.enrollmentToken.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            device: { select: { id: true, deviceName: true, hostname: true, serialNumber: true, status: true } },
            createdBy: { select: { id: true, email: true, name: true } },
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: tokens.map((token) => ({
          id: token.id,
          label: token.label,
          device: token.device
            ? {
                id: token.device.id,
                deviceName: token.device.deviceName,
                hostname: token.device.hostname,
                serialNumber: token.device.serialNumber,
                status: token.device.status,
              }
            : null,
          createdBy: token.createdBy
            ? { id: token.createdBy.id, email: token.createdBy.email, name: token.createdBy.name }
            : null,
          expiresAt: toIso(token.expiresAt),
          maxUses: token.maxUses,
          uses: token.uses,
          remainingUses: Math.max(0, token.maxUses - token.uses),
          isActive: token.isActive,
          lastUsedAt: toIso(token.lastUsedAt),
          createdAt: toIso(token.createdAt),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  });

  // ─── Enrollment history ─────────────────────────────────────────────────────
  app.get('/enrollment-history', {
    preHandler: [authenticate, requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Chronological enrollment history derived from issued agent tokens',
      tags: ['Enrollment'],
      querystring: {
        type: 'object',
        additionalProperties: true,
        properties: {
          page: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const parsed = enrollmentTokenListQuerySchema.safeParse(request.query);
      const { page, limit } = parsed.success
        ? parsed.data
        : { page: 1, limit: 25 };

      const orgFilter: Prisma.AgentTokenWhereInput =
        jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

      const [total, agentTokens] = await Promise.all([
        app.prisma.agentToken.count({ where: orgFilter }),
        app.prisma.agentToken.findMany({
          where: orgFilter,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            deviceId: true,
            isActive: true,
            expiresAt: true,
            createdAt: true,
            device: {
              select: {
                id: true,
                deviceName: true,
                hostname: true,
                serialNumber: true,
                os: true,
                osVersion: true,
                agentVersion: true,
              },
            },
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: agentTokens.map((entry) => ({
          id: entry.id,
          device: entry.device,
          isCurrent: entry.isActive,
          isRevoked: !entry.isActive,
          expiresAt: toIso(entry.expiresAt),
          enrolledAt: toIso(entry.createdAt),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  });

  // ─── Admin: create enrollment token ──────────────────────────────────────────
  app.post('/enrollment-tokens', {
    preHandler: [authenticate, requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Create an enrollment token used by endpoint agents to register devices',
      tags: ['Enrollment'],
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          label: { type: 'string' },
          deviceId: { type: 'string', format: 'uuid' },
          expiresAt: { type: 'string' },
          maxUses: { type: 'integer', minimum: 1, maximum: 1000 },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const parsed = createEnrollmentTokenSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
        });
      }

      const { label, deviceId, expiresAt, maxUses } = parsed.data;
      const organizationId = jwtUser.organizationId;

      if (deviceId) {
        const device = await app.prisma.device.findFirst({
          where: { id: deviceId, organizationId },
          select: { id: true },
        });
        if (!device) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Device not found in organization' },
          });
        }
      }

      const rawToken = generateToken();
      const token = await app.prisma.enrollmentToken.create({
        data: {
          organizationId,
          tokenHash: hashToken(rawToken),
          label,
          createdById: jwtUser.sub,
          deviceId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          maxUses,
        },
      });

      await writeAudit(app.prisma, jwtUser, 'ENROLLMENT_TOKEN_CREATED', 'ENROLLMENT_TOKEN', token.id, {
        label,
        maxUses,
        deviceId: deviceId ?? null,
      }, request).catch(() => undefined);

      return reply.status(201).send({
        success: true,
        data: {
          id: token.id,
          token: rawToken,
          label: token.label,
          deviceId: token.deviceId,
          expiresAt: toIso(token.expiresAt),
          maxUses: token.maxUses,
          isActive: token.isActive,
        },
      });
    },
  });

  // ─── Admin: revoke enrollment token ──────────────────────────────────────────
  app.delete('/enrollment-tokens/:id', {
    preHandler: [authenticate, requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Revoke an enrollment token',
      tags: ['Enrollment'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const params = enrollmentParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: params.error.issues[0]?.message ?? 'Invalid enrollment token id',
          },
        });
      }

      const where: Prisma.EnrollmentTokenWhereInput =
        jwtUser.role === 'SUPER_ADMIN'
          ? { id: params.data.id }
          : { id: params.data.id, organizationId: jwtUser.organizationId };

      const existing = await app.prisma.enrollmentToken.findFirst({ where });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Enrollment token not found' },
        });
      }

      const updated = await app.prisma.enrollmentToken.update({
        where: { id: existing.id },
        data: { isActive: false },
      });

      await writeAudit(app.prisma, jwtUser, 'ENROLLMENT_TOKEN_REVOKED', 'ENROLLMENT_TOKEN', existing.id, {
        label: existing.label,
      }, request).catch(() => undefined);

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          isActive: updated.isActive,
          revokedAt: toIso(updated.updatedAt),
        },
      });
    },
  });

  // ─── Public: device enrollment ───────────────────────────────────────────────
  app.post('/enroll', {
    schema: {
      description: 'Enroll an endpoint agent into the platform using an enrollment token',
      tags: ['Enrollment'],
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          enrollmentToken: { type: 'string' },
          hostname: { type: 'string' },
          serialNumber: { type: 'string' },
          os: { type: 'string' },
          osVersion: { type: 'string' },
          agentVersion: { type: 'string' },
          manufacturer: { type: 'string' },
          model: { type: 'string' },
          ipAddress: { type: 'string' },
          architecture: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = enrollDeviceSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
        });
      }

      const {
        enrollmentToken,
        hostname,
        serialNumber,
        os,
        osVersion,
        agentVersion,
        manufacturer,
        model,
        ipAddress,
        architecture,
      } = parsed.data;

      const token = await app.prisma.enrollmentToken.findUnique({
        where: { tokenHash: hashToken(enrollmentToken) },
        include: { organization: true },
      });

      if (!token || !token.isActive) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_ENROLLMENT_TOKEN', message: 'Enrollment token is invalid or revoked' },
        });
      }

      if (token.expiresAt && token.expiresAt.getTime() < Date.now()) {
        return reply.status(401).send({
          success: false,
          error: { code: 'ENROLLMENT_TOKEN_EXPIRED', message: 'Enrollment token has expired' },
        });
      }

      if (token.uses >= token.maxUses) {
        return reply.status(429).send({
          success: false,
          error: { code: 'ENROLLMENT_TOKEN_EXHAUSTED', message: 'Enrollment token has reached its usage limit' },
        });
      }

      const organizationId = token.organizationId;
      const deviceName = hostname.toUpperCase();

      // Attach to a pre-provisioned device or resolve by (org, serialNumber), else create.
      const existingDevice = token.deviceId
        ? await app.prisma.device.findFirst({ where: { id: token.deviceId, organizationId } })
        : await app.prisma.device.findUnique({
            where: { organizationId_serialNumber: { organizationId, serialNumber } },
          });

      const device = existingDevice ?? (await app.prisma.device.create({
        data: {
          organizationId,
          deviceName,
          hostname,
          serialNumber,
          manufacturer: manufacturer ?? '',
          model: model ?? '',
          os,
          osVersion,
          architecture: architecture ?? '',
          ipAddress: ipAddress ?? '',
          agentVersion,
          status: 'PENDING',
        },
      }));

      if (existingDevice) {
        await app.prisma.device.update({
          where: { id: device.id },
          data: {
            deviceName,
            hostname,
            manufacturer: manufacturer ?? device.manufacturer,
            model: model ?? device.model,
            os,
            osVersion,
            architecture: architecture ?? device.architecture,
            ipAddress: ipAddress ?? device.ipAddress,
            agentVersion,
            status: 'PENDING',
            lastSeenAt: new Date(),
          },
        });
      }

      // Issue a fresh per-device agent token (revoke any previous ones).
      const agentTokenRaw = generateAgentToken();
      await app.prisma.agentToken.updateMany({
        where: { deviceId: device.id, isActive: true },
        data: { isActive: false },
      });
      const agentToken = await app.prisma.agentToken.create({
        data: {
          organizationId,
          deviceId: device.id,
          tokenHash: hashToken(agentTokenRaw),
          expiresAt: token.expiresAt,
        },
      });

      await app.prisma.deviceHeartbeat.create({
        data: {
          deviceId: device.id,
          agentVersion,
          timestamp: new Date(),
          status: 'ENROLLED',
        },
      });

      const usedAt = new Date();
      await app.prisma.enrollmentToken.update({
        where: { id: token.id },
        data: {
          uses: { increment: 1 },
          isActive: token.uses + 1 >= token.maxUses ? false : true,
          lastUsedAt: usedAt,
          // Pin the token to the device it enrolled so usage history is traceable.
          deviceId: device.id,
        },
      });

      // Enrollment is a security-relevant event: record it against the org.
      await app.prisma.auditLog.create({
        data: {
          organizationId,
          actorId: null,
          action: 'DEVICE_ENROLLED',
          resource: 'DEVICE',
          resourceId: device.id,
          ipAddress: ipAddress ?? '',
          metadata: JSON.stringify({
            deviceName,
            hostname,
            serialNumber,
            agentVersion,
            os,
            tokenId: token.id,
            tokenLabel: token.label,
            reEnrollment: Boolean(existingDevice),
          }),
          timestamp: usedAt,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          deviceId: device.id,
          deviceName: device.deviceName,
          agentToken: agentTokenRaw,
          expiresAt: toIso(agentToken.expiresAt),
          status: device.status,
        },
      });
    },
  });

  // ─── Get active organization token snippet ─────────────────────────────────
  app.get('/token', {
    preHandler: [authenticate, requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Get organization enrollment token and agent installation snippets',
      tags: ['Enrollment'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const orgId = jwtUser.organizationId;

      const org = await app.prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        });
      }

      // Hashes are one-way, so a usable code cannot be recovered from an
      // existing token: mint a fresh single-use code for this snippet.
      const rawToken = generateToken();
      const token = await app.prisma.enrollmentToken.create({
        data: {
          organizationId: orgId,
          tokenHash: hashToken(rawToken),
          label: 'Install snippet',
          createdById: jwtUser.sub,
          maxUses: 1,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const host = request.headers.host ?? `localhost:${loadConfig().API_PORT}`;
      const apiBaseUrl = `${request.protocol}://${host}/api`;
      const powershellCommand = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $env:RICOZ_ENROLL_TOKEN="${rawToken}"; $env:RICOZ_API_URL="${apiBaseUrl}"; iwr -useb "${apiBaseUrl}/agent/install.ps1" | iex`;

      return reply.send({
        success: true,
        data: {
          organizationId: org.id,
          organizationName: org.name,
          enrollmentToken: rawToken,
          enrollmentTokenId: token.id,
          expiresAt: toIso(token.expiresAt),
          apiBaseUrl,
          powershellInstallCommand: powershellCommand,
          enrollmentUrl: `${apiBaseUrl}/enroll`,
        },
      });
    },
  });
}