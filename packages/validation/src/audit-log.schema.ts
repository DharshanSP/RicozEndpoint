import { z } from 'zod';

export const auditLogListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  action: z.string().max(255).optional(),
  resource: z.string().max(255).optional(),
  actorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AuditLogListQueryInput = z.infer<typeof auditLogListQuerySchema>;

export const auditLogParamsSchema = z.object({
  id: z.string().uuid('Invalid audit log id'),
});

export type AuditLogParamsInput = z.infer<typeof auditLogParamsSchema>;