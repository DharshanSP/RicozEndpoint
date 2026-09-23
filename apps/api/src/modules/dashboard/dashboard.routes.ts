import type { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/rbac.middleware';

const RANGE_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const OS_COLORS = ['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500'];

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

function eventStatusFromAction(action: string): string {
  const upper = action.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('FAIL')) return 'error';
  if (upper.includes('DELETE') || upper.includes('WARN')) return 'warning';
  return 'success';
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', {
    preHandler: [authenticate],
    schema: {
      description: 'System admin dashboard telemetry and operational summary',
      tags: ['Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['24h', '7d', '30d'], default: '24h' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalDevices: { type: 'number' },
                onlineDevices: { type: 'number' },
                offlineDevices: { type: 'number' },
                pendingEnrollment: { type: 'number' },
                complianceScore: { type: 'number' },
                compliantDevices: { type: 'number' },
                nonCompliantDevices: { type: 'number' },
                openAlertsCount: { type: 'number' },
                criticalAlertsCount: { type: 'number' },
                warningAlertsCount: { type: 'number' },
                failedActionsCount: { type: 'number' },
                osDistribution: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      count: { type: 'number' },
                      percentage: { type: 'number' },
                      color: { type: 'string' },
                    },
                  },
                },
                complianceControls: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      compliantCount: { type: 'number' },
                      total: { type: 'number' },
                      status: { type: 'string' },
                    },
                  },
                },
                activeAlerts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      severity: { type: 'string' },
                      title: { type: 'string' },
                      hostname: { type: 'string' },
                      ipAddress: { type: 'string' },
                      time: { type: 'string' },
                      category: { type: 'string' },
                    },
                  },
                },
                recentEvents: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string' },
                      description: { type: 'string' },
                      actor: { type: 'string' },
                      time: { type: 'string' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const jwtUser = request.user as JwtPayload;
      const { range = '24h' } = request.query as { range?: string };

      const since = new Date(Date.now() - (RANGE_MS[range] ?? RANGE_MS['24h'] ?? 24 * 60 * 60 * 1000));
      const orgWhere = jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };

      // Device fleet status breakdown
      const [totalDevices, onlineDevices, offlineDevices, pendingEnrollment] = await Promise.all([
        app.prisma.device.count({ where: orgWhere }),
        app.prisma.device.count({ where: { ...orgWhere, status: 'ONLINE' } }),
        app.prisma.device.count({ where: { ...orgWhere, status: 'OFFLINE' } }),
        app.prisma.device.count({ where: { ...orgWhere, status: 'PENDING' } }),
      ]);

      // Operating system distribution
      const osGroups = await app.prisma.device.groupBy({
        by: ['osVersion'],
        where: orgWhere,
        _count: { _all: true },
        orderBy: { _count: { osVersion: 'desc' } },
      });

      const osDistribution = osGroups.map((group, index) => {
        const count = group._count._all ?? 0;
        return {
          name: group.osVersion,
          count,
          percentage: totalDevices > 0 ? Math.round((count / totalDevices) * 1000) / 10 : 0,
          color: OS_COLORS[index % OS_COLORS.length],
        };
      });

      // Open alerts + severity buckets
      const openAlerts = await app.prisma.alert.findMany({
        where: { ...orgWhere, status: 'OPEN', createdAt: { gte: since } },
        include: { device: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const [openAlertsCount, criticalAlertsCount, warningAlertsCount, failedActionsCount] = await Promise.all([
        app.prisma.alert.count({ where: { ...orgWhere, status: 'OPEN' } }),
        app.prisma.alert.count({ where: { ...orgWhere, status: 'OPEN', severity: 'CRITICAL' } }),
        app.prisma.alert.count({ where: { ...orgWhere, status: 'OPEN', severity: 'WARNING' } }),
        app.prisma.command.count({ where: { ...orgWhere, status: 'FAILED' } }),
      ]);

      // Compliance status across devices (per latest result)
      const [compliantDevices, nonCompliantDevices] = await Promise.all([
        app.prisma.device.count({
          where: {
            ...orgWhere,
            complianceResults: { some: { status: 'COMPLIANT', NOT: { ruleId: null } } },
          },
        }),
        app.prisma.device.count({
          where: {
            ...orgWhere,
            complianceResults: { some: { status: 'NON_COMPLIANT' } },
          },
        }),
      ]);

      // Compliance rules + per-rule result aggregation
      const complianceRules = await app.prisma.complianceRule.findMany({
        where: { organizationId: jwtUser.organizationId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      const ruleResultCounts = await Promise.all(
        complianceRules.map(async (rule) => {
          const [compliantCount, total] = await Promise.all([
            app.prisma.complianceResult.count({
              where: { ruleId: rule.id, status: 'COMPLIANT', evaluatedAt: { gte: since } },
            }),
            app.prisma.complianceResult.count({
              where: { ruleId: rule.id, evaluatedAt: { gte: since } },
            }),
          ]);
          return { rule, compliantCount, total };
        })
      );

      const complianceControls = ruleResultCounts.map(({ rule, compliantCount, total }) => {
        const status = total > 0 && compliantCount === total ? 'Compliant' : total === 0 ? 'Not Evaluated' : 'At Risk';
        return {
          name: rule.name,
          compliantCount,
          total,
          status,
        };
      });

      const evaluatedResults = ruleResultCounts.reduce((sum, item) => sum + item.total, 0);
      const compliantResults = ruleResultCounts.reduce((sum, item) => sum + item.compliantCount, 0);
      const complianceScore = evaluatedResults > 0 ? Math.round((compliantResults / evaluatedResults) * 1000) / 10 : 100;

      // Recent environment activity
      const recentAuditLogs = await app.prisma.auditLog.findMany({
        where: { ...orgWhere, timestamp: { gte: since } },
        include: { actor: { select: { name: true } } },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      const activeAlerts = openAlerts.map((alert) => ({
        id: alert.id.slice(0, 8).toUpperCase(),
        severity: alert.severity.toLowerCase(),
        title: alert.title,
        hostname: alert.device?.hostname ?? 'Unknown Host',
        ipAddress: alert.device?.ipAddress ?? '-',
        time: formatTimeAgo(alert.createdAt),
        category:
          alert.severity === 'CRITICAL' ? 'Security' : alert.severity === 'WARNING' ? 'Operations' : 'System',
      }));

      const recentEvents = recentAuditLogs.map((log) => ({
        id: log.id.slice(0, 8).toUpperCase(),
        type: humanize(log.resource),
        description: `${humanize(log.action)} — ${log.resourceId.slice(0, 8)}`,
        actor: log.actor.name,
        time: formatTimeAgo(log.timestamp),
        status: eventStatusFromAction(log.action),
      }));

      return reply.send({
        success: true,
        data: {
          totalDevices,
          onlineDevices,
          offlineDevices,
          pendingEnrollment,
          complianceScore,
          compliantDevices,
          nonCompliantDevices,
          openAlertsCount,
          criticalAlertsCount,
          warningAlertsCount,
          failedActionsCount,
          osDistribution,
          complianceControls,
          activeAlerts,
          recentEvents,
        },
      });
    },
  });
}