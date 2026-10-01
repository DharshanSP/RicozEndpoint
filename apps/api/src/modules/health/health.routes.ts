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
        version: process.env.npm_package_version ?? '0.1.0',
      };

      // Always 200: the payload carries the degraded state so probes can read it.
      return reply.send(payload);
    },
  });
}
