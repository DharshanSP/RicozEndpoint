import { z } from 'zod';

export const alertSeverityEnum = z.enum(['INFO', 'WARNING', 'CRITICAL']);
export type AlertSeverity = z.infer<typeof alertSeverityEnum>;

export const alertStatusEnum = z.enum(['OPEN', 'RESOLVED']);
export type AlertStatus = z.infer<typeof alertStatusEnum>;

export const alertTypeEnum = z.enum([
  'DEVICE_OFFLINE',
  'COMMAND_FAILED',
  'COMPLIANCE_VIOLATION',
  'SECURITY',
  'POLICY',
  'INFO',
]);
export type AlertType = z.infer<typeof alertTypeEnum>;

export const alertListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: alertStatusEnum.optional(),
  severity: alertSeverityEnum.optional(),
  type: alertTypeEnum.optional(),
  deviceId: z.string().uuid().optional(),
  search: z.string().optional(),
});
export type AlertListQueryInput = z.infer<typeof alertListQuerySchema>;

export const alertParamsSchema = z.object({
  id: z.string().uuid('Invalid alert id'),
});

export const alertResolveSchema = z.object({
  note: z.string().max(1000).optional(),
});
export type AlertResolveInput = z.infer<typeof alertResolveSchema>;

export const alertCreateSchema = z.object({
  deviceId: z.string().uuid(),
  type: alertTypeEnum,
  severity: alertSeverityEnum,
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  dedupKey: z.string().max(500).optional(),
});
export type AlertCreateInput = z.infer<typeof alertCreateSchema>;
