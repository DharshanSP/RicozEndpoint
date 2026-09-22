import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hashToken } from '../utils/tokens';

export interface AgentDevicePayload {
  id: string;
  organizationId: string;
  serialNumber: string;
  status: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    agentDevice?: AgentDevicePayload;
  }
}

/**
 * Authenticate a device agent using its per-device agent token.
 * The raw token travels in the `X-Agent-Token` header and is stored hashed.
 */
export function authenticateAgent(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const headerValue = request.headers['x-agent-token'];
    if (!headerValue || typeof headerValue !== 'string') {
      return reply.status(401).send({
        success: false,
        error: { code: 'AGENT_TOKEN_REQUIRED', message: 'X-Agent-Token header is required' },
      });
    }

    const tokenHash = hashToken(headerValue);
    const agentToken = await app.prisma.agentToken.findUnique({
      where: { tokenHash },
      include: { device: true },
    });

    if (!agentToken || !agentToken.isActive) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_AGENT_TOKEN', message: 'Agent token is invalid or revoked' },
      });
    }

    if (agentToken.expiresAt && agentToken.expiresAt.getTime() < Date.now()) {
      return reply.status(401).send({
        success: false,
        error: { code: 'AGENT_TOKEN_EXPIRED', message: 'Agent token has expired' },
      });
    }

    request.agentDevice = {
      id: agentToken.device.id,
      organizationId: agentToken.device.organizationId,
      serialNumber: agentToken.device.serialNumber,
      status: agentToken.device.status,
    };
  };
}