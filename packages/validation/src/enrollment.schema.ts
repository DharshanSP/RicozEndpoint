import { z } from 'zod';

export const createEnrollmentTokenSchema = z.object({
  label: z.string().max(255).optional().default(''),
  deviceId: z.string().uuid('Invalid device id').optional(),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.coerce.number().int().min(1).max(1000).default(1),
});

export type CreateEnrollmentTokenInput = z.infer<typeof createEnrollmentTokenSchema>;

export const enrollmentTokenListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  includeRevoked: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((value): boolean => value === 'true'),
});

export type EnrollmentTokenListQueryInput = z.infer<typeof enrollmentTokenListQuerySchema>;

export const enrollmentParamsSchema = z.object({
  id: z.string().uuid('Invalid enrollment token id'),
});

export type EnrollmentParamsInput = z.infer<typeof enrollmentParamsSchema>;