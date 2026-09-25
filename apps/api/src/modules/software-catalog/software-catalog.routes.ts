import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireMinRole, JwtPayload } from '../../middleware/rbac.middleware';
import { UserRole } from '@ricoz/shared-types';
import { softwareCatalogQuerySchema } from '@ricoz/validation';

interface SoftwareRow {
  name: string;
  version: string;
  publisher: string;
  deviceId: string;
}

interface VersionBucket {
  version: string;
  count: number;
}

interface CatalogItem {
  name: string;
  publisher: string;
  deviceCount: number;
  versions: VersionBucket[];
  latestVersion: string;
}

interface AggState extends CatalogItem {
  seenDevices: Set<string>;
  seenVersions: Set<string>;
}

const MAX_ROWS = 10_000;

function countCompare(a: string, b: string): number {
  const am = Number.parseInt(a.replace(/\D/g, ''), 10) || 0;
  const bm = Number.parseInt(b.replace(/\D/g, ''), 10) || 0;
  return bm - am;
}

export async function softwareCatalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    preHandler: [requireMinRole(UserRole.VIEWER)],
    schema: {
      description: 'Aggregate software catalog across the organization inventory',
      tags: ['Software Catalog'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          sortBy: { type: 'string', enum: ['name', 'publisher', 'deviceCount'], default: 'name' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const jwtUser = request.user as JwtPayload;
      const query = softwareCatalogQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: query.error.issues[0]?.message ?? 'Invalid query parameters',
          },
        });
      }

      const { page, limit, search, sortBy, sortOrder } = query.data;

      const rows = (await app.prisma.deviceSoftware.findMany({
        where: {
          device: jwtUser.role === 'SUPER_ADMIN' ? {} : { organizationId: jwtUser.organizationId },
        },
        select: { deviceId: true, name: true, version: true, publisher: true },
        orderBy: { name: 'asc' },
        take: MAX_ROWS,
      })) as unknown as SoftwareRow[];

      const buckets = new Map<string, AggState>();
      for (const row of rows) {
        const key = `${row.name.trim().toLowerCase()}::${row.publisher.trim().toLowerCase()}`;
        let item = buckets.get(key);
        if (!item) {
          item = {
            name: row.name.trim(),
            publisher: row.publisher.trim(),
            deviceCount: 0,
            versions: [],
            latestVersion: row.version,
            seenDevices: new Set<string>(),
            seenVersions: new Set<string>(),
          };
          buckets.set(key, item);
        }
        if (!item.seenDevices.has(row.deviceId)) {
          item.seenDevices.add(row.deviceId);
          item.deviceCount += 1;
        }
        if (!item.seenVersions.has(row.version)) {
          item.seenVersions.add(row.version);
          item.versions.push({ version: row.version, count: 1 });
        } else {
          const bucket = item.versions.find((entry) => entry.version === row.version);
          if (bucket) bucket.count += 1;
        }
      }

      let items = Array.from(buckets.values()).map((state) => ({
        name: state.name,
        publisher: state.publisher,
        deviceCount: state.deviceCount,
        versions: state.versions,
        latestVersion: state.versions[0]?.version ?? '',
      }));

      if (search) {
        const needle = search.toLowerCase();
        items = items.filter(
          (item) => item.name.toLowerCase().includes(needle) || item.publisher.toLowerCase().includes(needle)
        );
      }

      items.forEach((item) => {
        item.latestVersion = item.versions.sort((a, b) => countCompare(b.version, a.version))[0]?.version ?? '';
      });

      const total = items.length;
      items.sort((a, b) => {
        const aVal = sortBy === 'name' ? a.name : sortBy === 'publisher' ? a.publisher : a.deviceCount;
        const bVal = sortBy === 'name' ? b.name : sortBy === 'publisher' ? b.publisher : b.deviceCount;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortOrder === 'asc' ? cmp : -cmp;
      });

      const paginated = items.slice((page - 1) * limit, page * limit);

      return reply.send({
        success: true,
        data: {
          items: paginated,
          total,
          page,
          limit,
        },
      });
    },
  });
}