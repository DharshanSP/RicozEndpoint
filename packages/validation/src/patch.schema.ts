import { z } from 'zod';

export const patchSeverityEnum = z.enum(['CRITICAL', 'IMPORTANT', 'OPTIONAL']);
export type PatchSeverity = z.infer<typeof patchSeverityEnum>;

export const patchStatusEnum = z.enum(['PENDING', 'APPROVED', 'DEPLOYED']);
export type PatchStatus = z.infer<typeof patchStatusEnum>;

export const patchDeviceStatusEnum = z.enum(['MISSING', 'INSTALLED', 'FAILED']);
export type PatchDeviceStatus = z.infer<typeof patchDeviceStatusEnum>;

export const patchListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  severity: patchSeverityEnum.optional(),
  status: patchStatusEnum.optional(),
  deviceStatus: patchDeviceStatusEnum.optional(),
  search: z.string().optional(),
});
export type PatchListQueryInput = z.infer<typeof patchListQuerySchema>;

export const patchParamsSchema = z.object({
  id: z.string().uuid('Invalid patch id'),
});
export type PatchParamsInput = z.infer<typeof patchParamsSchema>;

export const patchCreateSchema = z.object({
  kbNumber: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^KB\d+$/i, 'kbNumber must look like KB1234567'),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional(),
  severity: patchSeverityEnum.default('IMPORTANT'),
  category: z.string().max(120).optional(),
  releaseDate: z.coerce.date().optional(),
  status: patchStatusEnum.optional(),
});
export type PatchCreateInput = z.infer<typeof patchCreateSchema>;

export const patchUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    severity: patchSeverityEnum.optional(),
    category: z.string().max(120).optional(),
    releaseDate: z.coerce.date().nullable().optional(),
    status: patchStatusEnum.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
export type PatchUpdateInput = z.infer<typeof patchUpdateSchema>;

export const patchDeploySchema = z
  .object({
    deviceIds: z.array(z.string().uuid()).max(500).optional(),
    groupIds: z.array(z.string().uuid()).max(50).optional(),
    confirmed: z.boolean().optional(),
  })
  .default({});
export type PatchDeployInput = z.infer<typeof patchDeploySchema>;
