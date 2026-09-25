import { z } from 'zod';

export const deviceGroupCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().default(''),
  deviceIds: z.array(z.string().uuid()).default([]),
});

export type DeviceGroupCreateInput = z.infer<typeof deviceGroupCreateSchema>;

export const deviceGroupUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});

export type DeviceGroupUpdateInput = z.infer<typeof deviceGroupUpdateSchema>;

export const deviceGroupParamsSchema = z.object({
  id: z.string().uuid('Invalid device group id'),
});

export type DeviceGroupParamsInput = z.infer<typeof deviceGroupParamsSchema>;

export const deviceGroupListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type DeviceGroupListQueryInput = z.infer<typeof deviceGroupListQuerySchema>;

export const deviceGroupMembersSchema = z.object({
  deviceIds: z.array(z.string().uuid()).min(1, 'Provide at least one deviceId'),
});

export type DeviceGroupMembersInput = z.infer<typeof deviceGroupMembersSchema>;