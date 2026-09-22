export * from './auth.schema';
export * from './inventory.schema';
export * from './agent.schema';
export * from './enrollment.schema';
import { z } from 'zod';

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

export const deviceStatusEnum = z.enum([
  'ONLINE',
  'OFFLINE',
  'UNKNOWN',
  'PENDING',
  'NON_COMPLIANT',
]);

export type DeviceStatusType = z.infer<typeof deviceStatusEnum>;

export const deviceSortByEnum = z.enum([
  'deviceName',
  'hostname',
  'serialNumber',
  'manufacturer',
  'model',
  'os',
  'osVersion',
  'ipAddress',
  'agentVersion',
  'status',
  'lastSeenAt',
  'registeredAt',
  'createdAt',
  'updatedAt',
]);

export type DeviceSortByType = z.infer<typeof deviceSortByEnum>;

export const deviceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: deviceStatusEnum.optional(),
  os: z.string().optional(),
  sortBy: deviceSortByEnum.default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type DeviceListQueryInput = z.infer<typeof deviceListQuerySchema>;

export const deviceParamsSchema = z.object({
  id: z.string().uuid('Invalid device id'),
});

export type DeviceParamsInput = z.infer<typeof deviceParamsSchema>;

export const deviceActivityQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type DeviceActivityQueryInput = z.infer<typeof deviceActivityQuerySchema>;