import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { loadConfig } from './config';
import prismaPlugin from './plugins/prisma';
import { authRoutes } from './modules/auth/auth.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { devicesRoutes } from './modules/devices/devices.routes';
import { healthRoutes } from './modules/health/health.routes';
import { usersRoutes } from './modules/users/users.routes';
import { enrollmentRoutes } from './modules/enrollment/enrollment.routes';
import { agentRoutes } from './modules/agent/agent.routes';

const config = loadConfig();

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        config.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRY },
  });

  await app.register(prismaPlugin);

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'RicozEndpoint API',
        description: 'Enterprise Endpoint Management Platform',
        version: '0.1.0',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(devicesRoutes, { prefix: '/api/devices' });
  await app.register(dashboardRoutes, { prefix: '/api' });
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(enrollmentRoutes, { prefix: '/api' });
  await app.register(agentRoutes, { prefix: '/api/agent' });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const errCode = (error as { code?: string }).code;
    const message = (error as { message?: string }).message;

    app.log.error(error);

    reply.status(statusCode).send({
      success: false,
      error: {
        code: errCode ?? 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'Internal server error' : message,
      },
    });
  });

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
    app.log.info(`Server running on port ${config.API_PORT}`);
    app.log.info(`API docs available at http://localhost:${config.API_PORT}/docs`);
  } catch (err) {
    app.log.error(err as Error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
