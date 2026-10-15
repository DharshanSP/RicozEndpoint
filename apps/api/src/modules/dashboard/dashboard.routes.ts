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
                untestedDevices: { type: 'number' },
                openAlertsCount: { type: 'number' },
                criticalAlertsCount: { type: 'number' },
                warningAlertsCount: { type: 'number' },
                failedActionsCount: { type: 'number' },
                patchSummary: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    pending: { type: 'number' },
                    approved: { type: 'number' },
                    deployed: { type: 'number' },
                    failedInstalls: { type: 'number' },
                  },
                },
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

      const unresolvedWhere = { ...orgWhere, status: { in: ['OPEN', 'ACKNOWLEDGED'] } };
      // Demo logins only ever see demo-seeded fleet devices — real enrolled
      // endpoints stay hidden from them, mirroring the device list.
      const demoDeviceWhere = jwtUser.isDemoAccount ? { isDemoSeed: true } : {};
      const demoAlertWhere = jwtUser.isDemoAccount ? { device: { isDemoSeed: true } } : {};
      const scopedUnresolvedWhere = { ...unresolvedWhere, ...demoAlertWhere };
      // Patches carry organizationId directly, so the fleet scope applies as-is.
      // DevicePatch rows are scoped through their parent patch.
      const patchScope = jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId };
      // A device is non-compliant when any stored result for it is
      // NON_COMPLIANT, compliant when it has results and none are failing,
      // untested when it has no results at all.
      const complianceScope = {
        device: {
          ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
          ...(jwtUser.isDemoAccount ? { isDemoSeed: true } : {}),
        },
      };

      // Every aggregation below is independent, so they are issued as a single
      // round of parallel queries instead of one await per widget. This handler
      // is the landing page, so the round trips add up on every navigation.
      const [
        [totalDevices, onlineDevices, offlineDevices, pendingEnrollment],
        osGroups,
        openAlerts,
        [openAlertsCount, criticalAlertsCount, warningAlertsCount, failedActionsCount],
        [testedGroups, nonCompliantGroups],
        complianceRules,
        recentAuditLogs,
        [totalPatches, patchStatusGroups, failedInstalls],
      ] = await Promise.all([
        // Device fleet status breakdown
        Promise.all([
          app.prisma.device.count({ where: { ...orgWhere, ...demoDeviceWhere } }),
          app.prisma.device.count({ where: { ...orgWhere, ...demoDeviceWhere, status: 'ONLINE' } }),
          app.prisma.device.count({ where: { ...orgWhere, ...demoDeviceWhere, status: 'OFFLINE' } }),
          app.prisma.device.count({ where: { ...orgWhere, ...demoDeviceWhere, status: 'PENDING' } }),
        ]),
        // Operating system distribution
        app.prisma.device.groupBy({
          by: ['osVersion'],
          where: { ...orgWhere, ...demoDeviceWhere },
          _count: { _all: true },
          orderBy: { _count: { osVersion: 'desc' } },
        }),
        // Recent unresolved alerts (the widget only renders host + address)
        app.prisma.alert.findMany({
          where: { ...scopedUnresolvedWhere, createdAt: { gte: since } },
          select: {
            id: true,
            severity: true,
            title: true,
            createdAt: true,
            device: { select: { hostname: true, ipAddress: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        // Unresolved alert counts by severity + failed agent actions
        Promise.all([
          app.prisma.alert.count({ where: scopedUnresolvedWhere }),
          app.prisma.alert.count({ where: { ...scopedUnresolvedWhere, severity: 'CRITICAL' } }),
          app.prisma.alert.count({ where: { ...scopedUnresolvedWhere, severity: 'WARNING' } }),
          app.prisma.command.count({ where: { ...orgWhere, status: 'FAILED' } }),
        ]),
        // Compliance status rolled up per device
        Promise.all([
          app.prisma.complianceResult.groupBy({
            by: ['deviceId'],
            where: complianceScope,
            _count: { _all: true },
          }),
          app.prisma.complianceResult.groupBy({
            by: ['deviceId'],
            where: { ...complianceScope, status: 'NON_COMPLIANT' },
            _count: { _all: true },
          }),
        ]),
        // Active compliance rules (per-rule counts are aggregated in round 2)
        app.prisma.complianceRule.findMany({
          where: {
            ...(jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId }),
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        // Recent environment activity
        app.prisma.auditLog.findMany({
          where: { ...orgWhere, timestamp: { gte: since } },
          include: { actor: { select: { name: true } } },
          orderBy: { timestamp: 'desc' },
          take: 10,
        }),
        // Patch posture: catalog approval breakdown + failed installs
        Promise.all([
          app.prisma.patch.count({ where: orgWhere }),
          app.prisma.patch.groupBy({
            by: ['status'],
            where: orgWhere,
            _count: { _all: true },
          }),
          app.prisma.devicePatch.count({
            where: {
              status: 'FAILED',
              patch: patchScope,
              ...(jwtUser.isDemoAccount ? { device: { isDemoSeed: true } } : {}),
            },
          }),
        ]),
      ]);

      const osDistribution = osGroups.map((group, index) => {
        const count = group._count._all ?? 0;
        return {
          name: group.osVersion,
          count,
          percentage: totalDevices > 0 ? Math.round((count / totalDevices) * 1000) / 10 : 0,
          color: OS_COLORS[index % OS_COLORS.length],
        };
      });

      const nonCompliantIds = new Set(nonCompliantGroups.map((group) => group.deviceId));
      let compliantDevices = 0;
      let nonCompliantDevices = 0;
      for (const group of testedGroups) {
        if (nonCompliantIds.has(group.deviceId)) nonCompliantDevices += 1;
        else compliantDevices += 1;
      }
      const untestedDevices = Math.max(0, totalDevices - compliantDevices - nonCompliantDevices);

      // Round 2: per-rule result aggregation over all stored results (a 24h
      // window would otherwise make every control read "Not Evaluated"). Two
      // grouped aggregations instead of two counts per rule: the dashboard used
      // to issue 2 * N queries whenever the tenant had N active controls.
      const ruleIds = complianceRules.map((rule) => rule.id);
      const [ruleTotalGroups, ruleCompliantGroups] = await Promise.all([
        app.prisma.complianceResult.groupBy({
          by: ['ruleId'],
          where: { ruleId: { in: ruleIds } },
          _count: { _all: true },
        }),
        app.prisma.complianceResult.groupBy({
          by: ['ruleId'],
          where: { ruleId: { in: ruleIds }, status: 'COMPLIANT' },
          _count: { _all: true },
        }),
      ]);

      const totalsByRule = new Map(ruleTotalGroups.map((group) => [group.ruleId, group._count._all]));
      const compliantByRule = new Map(ruleCompliantGroups.map((group) => [group.ruleId, group._count._all]));

      const complianceControls = complianceRules.map((rule) => {
        const total = totalsByRule.get(rule.id) ?? 0;
        const compliantCount = compliantByRule.get(rule.id) ?? 0;
        const status =
          total > 0 && compliantCount === total ? 'Compliant' : total === 0 ? 'Not Evaluated' : 'At Risk';
        return { name: rule.name, compliantCount, total, status };
      });

      const evaluatedDevices = compliantDevices + nonCompliantDevices;
      const complianceScore =
        evaluatedDevices > 0 ? Math.round((compliantDevices / evaluatedDevices) * 1000) / 10 : 100;

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
        actor: log.actor?.name ?? 'System',
        time: formatTimeAgo(log.timestamp),
        status: eventStatusFromAction(log.action),
      }));

      const patchStatusCount = (status: string) =>
        patchStatusGroups.find((group) => group.status === status)?._count._all ?? 0;
      const patchSummary = {
        total: totalPatches,
        pending: patchStatusCount('PENDING'),
        approved: patchStatusCount('APPROVED'),
        deployed: patchStatusCount('DEPLOYED'),
        failedInstalls,
      };

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
          untestedDevices,
          openAlertsCount,
          criticalAlertsCount,
          warningAlertsCount,
          failedActionsCount,
          patchSummary,
          osDistribution,
          complianceControls,
          activeAlerts,
          recentEvents,
        },
      });
    },
  });
}