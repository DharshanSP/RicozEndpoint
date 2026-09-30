import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

export interface AgentContext {
  deviceId: string;
  organizationId: string;
  agentTokenId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    agent?: AgentContext;
  }
}

/**
 * Computes SHA-256 hash of a raw agent token.
 */
export function hashAgentToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Fastify preHandler hook to verify AgentToken for endpoint agents.
 */
export async function authenticateAgent(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const customHeader = request.headers['x-agent-token'] as string | undefined;

  let rawToken: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawToken = authHeader.substring(7).trim();
  } else if (customHeader) {
    rawToken = customHeader.trim();
  }

  if (!rawToken) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'AGENT_TOKEN_REQUIRED',
        message: 'Missing agent authorization token (Bearer token or X-Agent-Token header required)',
      },
    });
  }

  const tokenHash = hashAgentToken(rawToken);

  try {
    const agentToken = await request.server.prisma.agentToken.findUnique({
      where: { tokenHash },
      include: { device: true },
    });

    if (!agentToken || !agentToken.isActive) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_AGENT_TOKEN',
          message: 'Agent token is invalid, revoked, or inactive',
        },
      });
    }

    if (agentToken.expiresAt && new Date() > agentToken.expiresAt) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'EXPIRED_AGENT_TOKEN',
          message: 'Agent token has expired',
        },
      });
    }

    request.agent = {
      deviceId: agentToken.deviceId,
      organizationId: agentToken.organizationId,
      agentTokenId: agentToken.id,
    };
  } catch (err) {
    request.log.error(err, 'Failed to authenticate agent token');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify agent authorization',
      },
    });
  }
}