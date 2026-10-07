import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', {
    schema: {
      description: 'Health check endpoint (API process and database connectivity)',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            database: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            database: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
          },
        },
      },
    },
    handler: async (_request, reply) => {
      let database: 'up' | 'down' = 'down';
      try {
        await app.prisma.$queryRaw`SELECT 1`;
        database = 'up';
      } catch {
        database = 'down';
      }

      const payload = {
        status: database === 'up' ? 'ok' : 'degraded',
        database,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.1.0',
      };

      // Return 503 when degraded so orchestrators restart / stop routing.
      return reply.status(database === 'up' ? 200 : 503).send(payload);
    },
  });
}
