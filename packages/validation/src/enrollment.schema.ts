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

export const enrollmentTokenRequestStatusEnum = z.enum(['PENDING', 'APPROVED', 'DENIED', 'CANCELLED']);
export type EnrollmentTokenRequestStatus = z.infer<typeof enrollmentTokenRequestStatusEnum>;

export const createEnrollmentTokenRequestSchema = z.object({
  label: z.string().max(255).optional().default(''),
  requestNote: z.string().trim().min(1).max(1000),
  maxUses: z.coerce.number().int().min(1).max(1000).default(1),
  expiresAt: z.string().datetime().optional(),
});
export type CreateEnrollmentTokenRequestInput = z.infer<typeof createEnrollmentTokenRequestSchema>;

export const enrollmentTokenRequestListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: enrollmentTokenRequestStatusEnum.optional(),
});
export type EnrollmentTokenRequestListQueryInput = z.infer<typeof enrollmentTokenRequestListQuerySchema>;

export const decideEnrollmentTokenRequestSchema = z.object({
  adminNote: z.string().trim().max(1000).optional().default(''),
});
export type DecideEnrollmentTokenRequestInput = z.infer<typeof decideEnrollmentTokenRequestSchema>;