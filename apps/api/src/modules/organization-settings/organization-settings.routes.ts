import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole, OrganizationSettings } from '@ricoz/shared-types';
import { updateOrganizationSettingsSchema } from '@ricoz/validation';
import { writeAudit } from '../../utils/audit';

const DEFAULT_SETTINGS: OrganizationSettings = {
  agentHeartbeatIntervalSeconds: 60,
  offlineTimeoutMinutes: 15,
  alertRetentionDays: 30,
  auditRetentionDays: 365,
  defaultPolicyPriority: 100,
};

function parseSettings(raw: unknown): OrganizationSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS };
  const candidate = raw as Partial<OrganizationSettings>;
  return {
    agentHeartbeatIntervalSeconds: candidate.agentHeartbeatIntervalSeconds ?? DEFAULT_SETTINGS.agentHeartbeatIntervalSeconds,
    offlineTimeoutMinutes: candidate.offlineTimeoutMinutes ?? DEFAULT_SETTINGS.offlineTimeoutMinutes,
    alertRetentionDays: candidate.alertRetentionDays ?? DEFAULT_SETTINGS.alertRetentionDays,
    auditRetentionDays: candidate.auditRetentionDays ?? DEFAULT_SETTINGS.auditRetentionDays,
    defaultPolicyPriority: candidate.defaultPolicyPriority ?? DEFAULT_SETTINGS.defaultPolicyPriority,
  };
}

export async function organizationSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Get organization operational settings with defaults applied',
      tags: ['Organization Settings'],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const org = await app.prisma.organization.findUnique({
        where: { id: jwtUser.organizationId },
        select: { settingsJson: true },
      });

      const raw = org?.settingsJson as unknown;
      return reply.send({ success: true, data: { settings: parseSettings(raw) } });
    },
  });

  app.put('/', {
    preHandler: [requireMinRole(UserRole.ORG_ADMIN)],
    schema: {
      description: 'Update organization operational settings (partial update supported)',
      tags: ['Organization Settings'],
      body: {
        type: 'object',
        properties: {
          agentHeartbeatIntervalSeconds: { type: 'number' },
          offlineTimeoutMinutes: { type: 'number' },
          alertRetentionDays: { type: 'number' },
          auditRetentionDays: { type: 'number' },
          defaultPolicyPriority: { type: 'number' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const body = updateOrganizationSettingsSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: body.error.issues[0]?.message ?? 'Invalid settings payload',
            details: body.error.issues,
          },
        });
      }

      const input = body.data as Partial<OrganizationSettings>;

      const org = await app.prisma.organization.findUnique({
        where: { id: jwtUser.organizationId },
        select: { settingsJson: true, name: true },
      });
      if (!org) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        });
      }

      const current = parseSettings(org.settingsJson as unknown);
      const merged: OrganizationSettings = { ...current, ...input };

      await app.prisma.organization.update({
        where: { id: jwtUser.organizationId },
        data: { settingsJson: merged as unknown as object },
      });

      await writeAudit(app.prisma, jwtUser, 'SETTINGS_UPDATED', 'ORGANIZATION', jwtUser.organizationId, {
        changed: Object.keys(input),
      }, request);

      return reply.send({ success: true, data: { settings: merged } });
    },
  });
}