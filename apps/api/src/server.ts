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
import { organizationsRoutes } from './modules/organizations/organizations.routes';
import { complianceRoutes } from './modules/compliance/compliance.routes';
import { patchesRoutes } from './modules/patches/patches.routes';
import { startOfflineSweeper } from './services/device-status.service';

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

  const allowedOrigins = config.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    // Fail-closed in production: an empty allow-list denies cross-origin
    // requests instead of reflecting any origin.
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) {
        return callback(null, false);
      }
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRY },
  });

  // Baseline security headers (helmet-equivalent without an extra dependency).
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-XSS-Protection', '1; mode=block');
    return payload;
  });

  // Lightweight login brute-force guard (per-IP sliding window, in-memory).
  const loginHits = new Map<string, number[]>();
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'POST' && request.url.startsWith('/api/auth/login')) {
      const now = Date.now();
      const key = request.ip;
      const windowMs = 60_000;
      const maxHits = 20;
      const hits = (loginHits.get(key) ?? []).filter((t) => now - t < windowMs);
      hits.push(now);
      loginHits.set(key, hits);
      if (hits.length > maxHits) {
        return reply.status(429).send({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in a minute.' },
        });
      }
    }
  });

  await app.register(prismaPlugin);

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'RicozEndpoint API',
        description: 'Enterprise Endpoint Management Platform',
        version: process.env.APP_VERSION ?? '0.1.0',
      },
    },
  });

  // API docs are a dev tool: expose them outside production only.
  if (config.NODE_ENV !== 'production') {
    await app.register(swaggerUi, {
      routePrefix: '/docs',
    });
  }

  // Registered before the route plugins: `await app.register()` runs each
  // plugin immediately, so a child context created afterwards would keep
  // Fastify's default error shape instead of this envelope.
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

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(organizationsRoutes, { prefix: '/api/organizations' });
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
  await app.register(complianceRoutes, { prefix: '/api/compliance' });
  await app.register(patchesRoutes, { prefix: '/api/patches' });

  // Background offline detection: keeps device status and DEVICE_OFFLINE alerts
  // accurate without depending on a user opening the device list.
  let offlineSweeper: NodeJS.Timeout | null = null;
  app.addHook('onReady', async () => {
    offlineSweeper = startOfflineSweeper(app.prisma, app.log);
  });
  app.addHook('onClose', async () => {
    if (offlineSweeper) {
      clearInterval(offlineSweeper);
      offlineSweeper = null;
    }
  });

  // Graceful shutdown for orchestrators (Render, Docker, systemd).
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down gracefully');
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
    app.log.info(`Server running on port ${config.API_PORT} [${config.NODE_ENV}]`);
    if (config.NODE_ENV !== 'production') {
      app.log.info(`API docs available at http://localhost:${config.API_PORT}/docs`);
    }
  } catch (err) {
    app.log.error(err as Error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
