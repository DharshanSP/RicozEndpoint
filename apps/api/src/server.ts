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
import { policiesRoutes } from './modules/policies/policies.routes';
import { commandsRoutes } from './modules/commands/commands.routes';
import { alertsRoutes } from './modules/alerts/alerts.routes';
import { deviceGroupsRoutes } from './modules/device-groups/device-groups.routes';
import { auditLogsRoutes } from './modules/audit-logs/audit-logs.routes';
import { softwareCatalogRoutes } from './modules/software-catalog/software-catalog.routes';
import { organizationSettingsRoutes } from './modules/organization-settings/organization-settings.routes';

const config = loadConfig();

// Allow BigInt serialization in JSON responses
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

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
  await app.register(policiesRoutes, { prefix: '/api/policies' });
  await app.register(commandsRoutes, { prefix: '/api/commands' });
  await app.register(alertsRoutes, { prefix: '/api/alerts' });
  await app.register(deviceGroupsRoutes, { prefix: '/api/device-groups' });
  await app.register(auditLogsRoutes, { prefix: '/api/audit-logs' });
  await app.register(softwareCatalogRoutes, { prefix: '/api/software' });
  await app.register(organizationSettingsRoutes, { prefix: '/api/settings' });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const errCode = (error as { code?: string }).code;
    const message = (error as { message?: string }).message;

    app.log.error(error);

    // Map Fastify schema validation errors to VALIDATION_ERROR
    const isValidationError = errCode === 'FST_ERR_VALIDATION';

    reply.status(statusCode).send({
      success: false,
      error: {
        code: isValidationError ? 'VALIDATION_ERROR' : (errCode ?? 'INTERNAL_ERROR'),
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
