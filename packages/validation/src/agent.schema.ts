import { z } from 'zod';
import { hardwareInventorySchema, softwareInventorySchema } from './inventory.schema';

export const registerDeviceSchema = z.object({
  enrollmentToken: z.string().min(1, 'Enrollment token is required'),
  hostname: z.string().min(1, 'Hostname is required'),
  serialNumber: z.string().min(1, 'Serial number is required'),
  os: z.string().min(1, 'OS is required'),
  osVersion: z.string().min(1, 'OS version is required'),
  agentVersion: z.string().min(1, 'Agent version is required'),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const enrollDeviceSchema = registerDeviceSchema.extend({
  ipAddress: z.string().default(''),
  architecture: z.string().default(''),
});

export type EnrollDeviceInput = z.infer<typeof enrollDeviceSchema>;

export const heartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  agentVersion: z.string(),
  timestamp: z.string().datetime(),
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

export const deviceSecuritySchema = z.object({
  firewallEnabled: z.boolean().optional(),
  antivirusEnabled: z.boolean().optional(),
});

export type DeviceSecurityInput = z.infer<typeof deviceSecuritySchema>;

export const agentHeartbeatSchema = heartbeatSchema.extend({
  hardware: hardwareInventorySchema.optional(),
  software: softwareInventorySchema.optional(),
  security: deviceSecuritySchema.optional(),
});

export type AgentHeartbeatInput = z.infer<typeof agentHeartbeatSchema>;

export const commandResultSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED']),
  result: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type CommandResultInput = z.infer<typeof commandResultSchema>;