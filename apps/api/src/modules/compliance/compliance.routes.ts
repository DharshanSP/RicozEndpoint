import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import {
  complianceListQuerySchema,
  complianceDeviceParamsSchema,
  complianceHistoryQuerySchema,
  evaluateComplianceSchema,
} from '@ricoz/validation';
import { writeAudit } from '../../utils/audit';
import {
  evaluateDeviceCompliance,
  policyIdFromReason,
  stripPolicyMarker,
} from './compliance.service';

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/**
 * Upper bound on compliance rows materialised for a single rollup. Steady state
 * is one row per (device, effective policy) because re-evaluation replaces prior
 * policy rows, so this cap only bites on pathological history growth.
 */
const MAX_RESULTS_SCAN = 20000;

interface DeviceComplianceState {
  compliant: number;
  nonCompliant: number;
  total: number;
  reason: string;
  evaluatedAt: Date | null;
}

interface ControlAgg {
  key: string;
  name: string;
  kind: 'RULE' | 'POLICY';
  description: string;
  compliantCount: number;
  nonCompliantCount: number;
  devices: Set<string>;
}

function emptyState(): DeviceComplianceState {
  return { compliant: 0, nonCompliant: 0, total: 0, reason: '', evaluatedAt: null };
}

function controlStatus(control: { compliantCount: number; nonCompliantCount: number; devices: Set<string> }): string {
  if (control.devices.size === 0) return 'NOT_EVALUATED';
  return control.nonCompliantCount === 0 ? 'COMPLIANT' : 'AT_RISK';
}

export async function complianceRoutes(app: FastifyInstance): Promise<void> {
  const orgFilter = <T extends object = Prisma.DeviceWhereInput>(
    jwtUser: JwtPayload,
    extra: T = {} as T
  ) =>
    jwtUser.role === 'SUPER_ADMIN'
      ? extra
      : { ...extra, organizationId: jwtUser.organizationId };

  /**
   * Reduces stored results into per-device state. Policy results (ruleId null)
   * are already current — evaluation replaces them — while rule results are
   * historical, so only the newest row per (device, rule) is counted.
   * `results` must be ordered by evaluatedAt descending.
   */
  const reduceDeviceState = (
    rows: Array<{ deviceId: string; ruleId: string | null; status: string; reason: string; evaluatedAt: Date }>
  ) => {
    const state = new Map<string, DeviceComplianceState>();
    const seenRule = new Set<string>();

    for (const row of rows) {
      if (row.ruleId !== null) {
        const key = `${row.deviceId}:${row.ruleId}`;
        if (seenRule.has(key)) continue;
        seenRule.add(key);
      }

      const entry = state.get(row.deviceId) ?? emptyState();
      entry.total += 1;
      if (row.status === 'NON_COMPLIANT') {
        entry.nonCompliant += 1;
        if (!entry.reason) entry.reason = stripPolicyMarker(row.reason);
      } else {
        entry.compliant += 1;
      }
      if (!entry.evaluatedAt || row.evaluatedAt > entry.evaluatedAt) {
        entry.evaluatedAt = row.evaluatedAt;
      }
      state.set(row.deviceId, entry);
    }

    return state;
  };

  /** Reduces results inside the reporting window into per-control aggregates. */
  const reduceControls = (
    rows: Array<{
      deviceId: string;
      ruleId: string | null;
      status: string;
      reason: string;
    }>,
    ruleMeta: Map<string, { name: string; description: string }>,
    policyMeta: Map<string, { name: string; description: string }>
  ) => {
    const controls = new Map<string, ControlAgg>();

    const ensure = (key: string, name: string, kind: 'RULE' | 'POLICY', description: string) => {
      let control = controls.get(key);
      if (!control) {
        control = {
          key,
          name,
          kind,
          description,
          compliantCount: 0,
          nonCompliantCount: 0,
          devices: new Set<string>(),
        };
        controls.set(key, control);
      }
      return control;
    };

    // Seed every active source so rules/policies with no evaluations in the
    // window still surface (they render as NOT_EVALUATED instead of vanishing).
    for (const [id, meta] of ruleMeta) {
      ensure(`rule:${id}`, meta.name, 'RULE', meta.description);
    }
    for (const [id, meta] of policyMeta) {
      ensure(`policy:${id}`, meta.name, 'POLICY', meta.description);
    }

    for (const row of rows) {
      let control: ControlAgg | undefined;

      if (row.ruleId !== null) {
        const meta = ruleMeta.get(row.ruleId);
        control = ensure(`rule:${row.ruleId}`, meta?.name ?? 'Deleted rule', 'RULE', meta?.description ?? '');
      } else {
        const policyId = policyIdFromReason(row.reason);
        if (!policyId) continue;
        const meta = policyMeta.get(policyId);
        control = ensure(
          `policy:${policyId}`,
          meta?.name ?? 'Deleted policy',
          'POLICY',
          meta?.description ?? ''
        );
      }

      control.devices.add(row.deviceId);
      if (row.status === 'NON_COMPLIANT') control.nonCompliantCount += 1;
      else control.compliantCount += 1;
    }

    return controls;
  };

  // ─── Fleet compliance rollup ───────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Fleet-wide compliance rollup: score, summary, controls and devices',
      tags: ['Compliance'],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['1h', '24h', '7d', '30d', 'all'], default: '24h' },
          status: { type: 'string', enum: ['NON_COMPLIANT', 'COMPLIANT', 'UNTESTED', 'ALL'], default: 'NON_COMPLIANT' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          search: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const parsed = complianceListQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { range, status, page, limit, search } = parsed.data;
      const since = new Date(Date.now() - (RANGE_MS[range] ?? RANGE_MS['24h'] ?? 0));

      const devices = await app.prisma.device.findMany({
        where: orgFilter(jwtUser),
        select: {
          id: true,
          deviceName: true,
          hostname: true,
          serialNumber: true,
          os: true,
          osVersion: true,
          agentVersion: true,
          status: true,
          lastSeenAt: true,
          firewallEnabled: true,
          antivirusEnabled: true,
        },
        orderBy: { deviceName: 'asc' },
      });
      const deviceIds = devices.map((d) => d.id);

      const [rules, policies, allResults, windowResults] = await Promise.all([
        app.prisma.complianceRule.findMany({
          where: { organizationId: jwtUser.organizationId, isActive: true },
          select: { id: true, name: true, description: true },
          orderBy: { createdAt: 'asc' },
        }),
        app.prisma.policy.findMany({
          where: orgFilter(jwtUser, { isActive: true }),
          select: { id: true, name: true, description: true },
          orderBy: { createdAt: 'asc' },
        }),
        deviceIds.length === 0
          ? Promise.resolve([])
          : app.prisma.complianceResult.findMany({
              where: { deviceId: { in: deviceIds } },
              orderBy: { evaluatedAt: 'desc' },
              select: {
                id: true,
                deviceId: true,
                ruleId: true,
                status: true,
                reason: true,
                evaluatedAt: true,
              },
              take: MAX_RESULTS_SCAN,
            }),
        deviceIds.length === 0
          ? Promise.resolve([])
          : app.prisma.complianceResult.findMany({
              where: { deviceId: { in: deviceIds }, evaluatedAt: { gte: since } },
              orderBy: { evaluatedAt: 'desc' },
              select: {
                id: true,
                deviceId: true,
                ruleId: true,
                status: true,
                reason: true,
                evaluatedAt: true,
              },
              take: MAX_RESULTS_SCAN,
            }),
      ]);

      const ruleMeta = new Map(rules.map((r) => [r.id, { name: r.name, description: r.description }]));
      const policyMeta = new Map(policies.map((p) => [p.id, { name: p.name, description: p.description }]));

      const stateByDevice = reduceDeviceState(allResults);
      const controlAgg = reduceControls(windowResults, ruleMeta, policyMeta);

      let compliant = 0;
      let nonCompliant = 0;

      const rows = devices.map((device) => {
        const state = stateByDevice.get(device.id);
        let deviceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'UNTESTED' = 'UNTESTED';

        if (state && state.total > 0) {
          if (state.nonCompliant > 0) {
            deviceStatus = 'NON_COMPLIANT';
            nonCompliant += 1;
          } else {
            deviceStatus = 'COMPLIANT';
            compliant += 1;
          }
        }

        return {
          id: device.id,
          deviceName: device.deviceName,
          hostname: device.hostname,
          serialNumber: device.serialNumber,
          os: device.os,
          osVersion: device.osVersion,
          agentVersion: device.agentVersion,
          status: deviceStatus,
          deviceStatus: device.status,
          lastSeenAt: device.lastSeenAt,
          firewallEnabled: device.firewallEnabled,
          antivirusEnabled: device.antivirusEnabled,
          violations: state?.nonCompliant ?? 0,
          checks: state?.total ?? 0,
          reason: state?.reason ?? '',
          evaluatedAt: state?.evaluatedAt ?? null,
        };
      });

      const untested = devices.length - compliant - nonCompliant;
      const evaluated = compliant + nonCompliant;
      const score = evaluated > 0 ? Math.round((compliant / evaluated) * 1000) / 10 : 100;

      const controls = Array.from(controlAgg.values())
        .map((control) => ({
          id: control.key,
          name: control.name,
          kind: control.kind,
          description: control.description,
          compliantCount: control.compliantCount,
          nonCompliantCount: control.nonCompliantCount,
          evaluatedCount: control.devices.size,
          untestedCount: devices.length - control.devices.size,
          status: controlStatus(control),
        }))
        .sort((a, b) => {
          const order = { AT_RISK: 0, NOT_EVALUATED: 1, COMPLIANT: 2 } as Record<string, number>;
          const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        });

      const needle = search?.toLowerCase();
      const filtered = rows.filter((row) => {
        if (status !== 'ALL' && row.status !== status) return false;
        if (
          needle &&
          !row.deviceName.toLowerCase().includes(needle) &&
          !row.hostname.toLowerCase().includes(needle) &&
          !row.serialNumber.toLowerCase().includes(needle)
        ) {
          return false;
        }
        return true;
      });

      const total = filtered.length;
      const start = (page - 1) * limit;
      const paged = filtered.slice(start, start + limit);

      return reply.send({
        success: true,
        data: {
          range,
          score,
          summary: {
            totalDevices: devices.length,
            evaluated,
            compliant,
            nonCompliant,
            untested,
          },
          controls,
          devices: paged,
          pagination: { page, limit, total },
        },
      });
    },
  });

  // ─── Per-device compliance detail and history ──────────────────────────────
  const deviceHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const jwtUser = request.user as JwtPayload;
    const params = complianceDeviceParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: params.error.issues[0]?.message ?? 'Invalid device id',
        },
      });
    }

    const historyQuery = complianceHistoryQuerySchema.safeParse(request.query ?? {});
    const { limit, status } = historyQuery.success
      ? historyQuery.data
      : { limit: 50, status: 'ALL' as const };

    const device = await app.prisma.device.findFirst({
      where: orgFilter(jwtUser, { id: params.data.id }),
      select: {
        id: true,
        deviceName: true,
        hostname: true,
        serialNumber: true,
        os: true,
        osVersion: true,
        agentVersion: true,
        status: true,
        lastSeenAt: true,
        firewallEnabled: true,
        antivirusEnabled: true,
        organizationId: true,
        organization: { select: { id: true, name: true } },
      },
    });

    if (!device) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Device not found' },
      });
    }

    const [results, rules, policies] = await Promise.all([
      app.prisma.complianceResult.findMany({
        where: { deviceId: device.id },
        orderBy: { evaluatedAt: 'desc' },
        take: MAX_RESULTS_SCAN,
      }),
      app.prisma.complianceRule.findMany({
        where: { organizationId: jwtUser.organizationId },
        select: { id: true, name: true },
      }),
      app.prisma.policy.findMany({
        where: orgFilter<Prisma.PolicyWhereInput>(jwtUser),
        select: { id: true, name: true, type: true },
      }),
    ]);

    const ruleName = new Map(rules.map((r) => [r.id, r.name]));
    const policyName = new Map(policies.map((p) => [p.id, p.name]));

    const state = reduceDeviceState(results);
    const currentState = state.get(device.id) ?? emptyState();

    // Latest result per source, used as the "current checks" list.
    const seen = new Set<string>();
    const current: Array<{
      id: string;
      source: 'RULE' | 'POLICY';
      sourceId: string | null;
      name: string;
      status: string;
      reason: string;
      evaluatedAt: Date;
    }> = [];

    for (const result of results) {
      let sourceId: string | null;
      let source: 'RULE' | 'POLICY';
      let name: string;

      if (result.ruleId !== null) {
        sourceId = result.ruleId;
        source = 'RULE';
        name = ruleName.get(result.ruleId) ?? 'Deleted rule';
      } else {
        sourceId = policyIdFromReason(result.reason);
        if (!sourceId) continue;
        source = 'POLICY';
        name = policyName.get(sourceId) ?? 'Deleted policy';
      }

      const key = `${source}:${sourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      current.push({
        id: result.id,
        source,
        sourceId,
        name,
        status: result.status,
        reason: stripPolicyMarker(result.reason),
        evaluatedAt: result.evaluatedAt,
      });
    }

    current.sort((a, b) => a.name.localeCompare(b.name));

    const history = results
      .filter((r) => status === 'ALL' || r.status === status)
      .slice(0, limit)
      .map((result) => {
        const policyId = policyIdFromReason(result.reason);
        const sourceId = result.ruleId ?? policyId;
        return {
          id: result.id,
          status: result.status,
          reason: stripPolicyMarker(result.reason),
          evaluatedAt: result.evaluatedAt,
          source: (result.ruleId !== null ? 'RULE' : policyId ? 'POLICY' : 'UNKNOWN') as
            | 'RULE'
            | 'POLICY'
            | 'UNKNOWN',
          sourceName:
            result.ruleId !== null
              ? ruleName.get(result.ruleId) ?? 'Deleted rule'
              : policyId
                ? policyName.get(policyId) ?? 'Deleted policy'
                : 'Manual evaluation',
          sourceId,
        };
      });

    const summaryStatus =
      currentState.total === 0
        ? 'UNTESTED'
        : currentState.nonCompliant > 0
          ? 'NON_COMPLIANT'
          : 'COMPLIANT';

    return reply.send({
      success: true,
      data: {
        device: {
          id: device.id,
          deviceName: device.deviceName,
          hostname: device.hostname,
          serialNumber: device.serialNumber,
          os: device.os,
          osVersion: device.osVersion,
          agentVersion: device.agentVersion,
          status: device.status,
          lastSeenAt: device.lastSeenAt,
          firewallEnabled: device.firewallEnabled,
          antivirusEnabled: device.antivirusEnabled,
          organization: device.organization,
        },
        summary: {
          status: summaryStatus,
          compliant: currentState.compliant,
          nonCompliant: currentState.nonCompliant,
          total: currentState.total,
          evaluatedAt: currentState.evaluatedAt,
        },
        controls: current,
        history,
        historyTotal: results.length,
      },
    });
  };

  app.get('/device/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Per-device compliance summary, current checks and evaluation history',
      tags: ['Compliance'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          status: { type: 'string', enum: ['COMPLIANT', 'NON_COMPLIANT', 'ALL'], default: 'ALL' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: deviceHandler,
  });

  // Alias matching the plural form used in the target-deliverables spec.
  app.get('/devices/:id', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Alias of GET /compliance/device/:id',
      tags: ['Compliance'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: deviceHandler,
  });

  // ─── Trigger evaluation ────────────────────────────────────────────────────
  app.post('/evaluate', {
    preHandler: [requireMinRole(UserRole.IT_ADMIN)],
    schema: {
      description: 'Re-run compliance evaluation for one device, a list, or the whole fleet',
      tags: ['Compliance'],
      body: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', format: 'uuid' },
          deviceIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          all: { type: 'boolean' },
        },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
        400: { type: 'object', additionalProperties: true },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const parsed = evaluateComplianceSchema.safeParse(request.body ?? {});

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid evaluation request',
          },
        });
      }

      const { deviceId, deviceIds, all } = parsed.data;
      let targetIds: string[];

      if (deviceId) {
        const owned = await app.prisma.device.findFirst({
          where: orgFilter(jwtUser, { id: deviceId }),
          select: { id: true },
        });
        if (!owned) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Device not found' },
          });
        }
        targetIds = [owned.id];
      } else if (deviceIds) {
        const owned = await app.prisma.device.findMany({
          where: orgFilter(jwtUser, { id: { in: deviceIds } }),
          select: { id: true },
        });
        targetIds = owned.map((d) => d.id);
      } else {
        targetIds = await app.prisma.device
          .findMany({ where: orgFilter(jwtUser), select: { id: true } })
          .then((rows) => rows.map((d) => d.id));
      }

      const results: Array<{ deviceId: string; evaluated: number; violation: number }> = [];

      for (const id of targetIds) {
        const outcome = await evaluateDeviceCompliance(
          app.prisma,
          id,
          {},
          jwtUser.role === 'SUPER_ADMIN' ? undefined : jwtUser.organizationId
        );
        results.push({
          deviceId: id,
          evaluated: outcome.evaluated,
          violation: outcome.violation,
        });
      }

      const violations = results.reduce((sum, item) => sum + item.violation, 0);

      await writeAudit(
        app.prisma,
        jwtUser,
        'COMPLIANCE_EVALUATED',
        'DEVICE',
        deviceId ?? (all ? 'ALL' : targetIds[0] ?? ''),
        { scope: deviceId ? 'device' : deviceIds ? 'batch' : 'all', count: targetIds.length, violations },
        request
      );

      return reply.send({
        success: true,
        data: {
          evaluated: targetIds.length,
          violations,
          devices: results,
        },
      });
    },
  });
}
