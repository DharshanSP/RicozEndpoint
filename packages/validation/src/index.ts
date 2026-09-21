export * from './auth.schema';
import { z } from 'zod';

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

export const heartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  agentVersion: z.string(),
  timestamp: z.string().datetime(),
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

export const hardwareInventorySchema = z.object({
  hostname: z.string(),
  cpu: z.string(),
  cpuCores: z.number().int().positive(),
  ramBytes: z.number().int().positive(),
  storageBytes: z.number().int().positive(),
  manufacturer: z.string(),
  model: z.string(),
  serialNumber: z.string(),
  biosVersion: z.string(),
  os: z.string(),
  osVersion: z.string(),
  architecture: z.string(),
});

export type HardwareInventoryInput = z.infer<typeof hardwareInventorySchema>;

export const softwareItemSchema = z.object({
  name: z.string(),
  version: z.string(),
  publisher: z.string(),
  installDate: z.string().nullable(),
  architecture: z.string(),
});

export const softwareInventorySchema = z.object({
  items: z.array(softwareItemSchema),
});

export type SoftwareInventoryInput = z.infer<typeof softwareInventorySchema>;

export const createPolicySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['SECURITY', 'CONFIGURATION', 'COMPLIANCE']),
  description: z.string().max(1000).optional().default(''),
  settings: z.record(z.unknown()),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const createCommandSchema = z.object({
  deviceId: z.string().uuid(),
  type: z.enum([
    'REFRESH_INVENTORY',
    'SYNC_POLICY',
    'LOCK_DEVICE',
    'RESTART_DEVICE',
    'SHUTDOWN_DEVICE',
  ]),
});

export type CreateCommandInput = z.infer<typeof createCommandSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
