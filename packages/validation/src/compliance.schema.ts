import { z } from 'zod';

export const complianceRangeEnum = z.enum(['1h', '24h', '7d', '30d', 'all']);

export type ComplianceRangeType = z.infer<typeof complianceRangeEnum>;

/**
 * Fleet rollup query. `status` filters the returned device list; the summary
 * counters always describe the whole fleet regardless of this filter.
 */
export const complianceListQuerySchema = z.object({
  range: complianceRangeEnum.default('24h'),
  status: z.enum(['NON_COMPLIANT', 'COMPLIANT', 'UNTESTED', 'ALL']).default('NON_COMPLIANT'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).optional(),
});

export type ComplianceListQueryInput = z.infer<typeof complianceListQuerySchema>;

export const complianceDeviceParamsSchema = z.object({
  id: z.string().uuid('Invalid device id'),
});

export type ComplianceDeviceParamsInput = z.infer<typeof complianceDeviceParamsSchema>;

export const complianceHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['COMPLIANT', 'NON_COMPLIANT', 'ALL']).default('ALL'),
});

export type ComplianceHistoryQueryInput = z.infer<typeof complianceHistoryQuerySchema>;

/**
 * Manual re-evaluation request. Exactly one target selector must be provided:
 * a single device, an explicit list, or `all` for the caller's whole fleet.
 */
export const evaluateComplianceSchema = z
  .object({
    deviceId: z.string().uuid('Invalid device id').optional(),
    deviceIds: z.array(z.string().uuid('Invalid device id')).min(1).max(500).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => [value.deviceId, value.deviceIds, value.all].filter(Boolean).length === 1, {
    message: 'Provide exactly one of deviceId, deviceIds, or all',
    path: ['deviceId'],
  });

export type EvaluateComplianceInput = z.infer<typeof evaluateComplianceSchema>;
