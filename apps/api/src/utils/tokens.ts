import { createHash, randomBytes } from 'node:crypto';

export function generateToken(): string {
  return `rich_${randomBytes(24).toString('base64url')}`;
}

export function generateAgentToken(): string {
  return `agtk_${randomBytes(24).toString('base64url')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}