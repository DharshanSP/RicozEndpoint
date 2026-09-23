import { z } from 'zod';

export const policyTypeEnum = z.enum(['SECURITY', 'CONFIGURATION', 'COMPLIANCE']);
export type PolicyType = z.infer<typeof policyTypeEnum>;

const securitySettingsSchema = z.object({
  firewallRequired: z.boolean().default(false),
  antivirusRequired: z.boolean().default(false),
  autoLockMinutes: z.number().int().min(0).max(86400).optional(),
  passwordComplexity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

const configurationSettingsSchema = z.object({
  autoUpdates: z.boolean().optional(),
  registryKeys: z.array(z.object({ path: z.string(), value: z.unknown() })).optional(),
  powerShellScript: z.string().max(5000).optional(),
});

const complianceSettingsSchema = z.object({
  minOsVersion: z.string().optional(),
  minAgentVersion: z.string().optional(),
  minDiskFreeGb: z.number().int().min(0).optional(),
  requiredPatches: z.array(z.string()).optional(),
});

export const policySettingsSchema = z.union([
  securitySettingsSchema,
  configurationSettingsSchema,
  complianceSettingsSchema,
]);
export type PolicySettings = z.infer<typeof policySettingsSchema>;

const createPolicyBaseSchema = z.object({
  name: z.string().min(1).max(255),
  type: policyTypeEnum,
  description: z.string().max(1000).optional().default(''),
  settings: policySettingsSchema,
  isActive: z.boolean().default(true),
});

export const createPolicySchema = createPolicyBaseSchema;
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const updatePolicySchema = createPolicyBaseSchema.partial();
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;

export const policyParamsSchema = z.object({
  id: z.string().uuid('Invalid policy id'),
});

export const policyAssignSchema = z.object({
  deviceIds: z.array(z.string().uuid()).default([]),
  groupIds: z.array(z.string().uuid()).default([]),
  priority: z.number().int().min(0).max(1000).default(100),
  removeAssignment: z.boolean().default(false),
});
export type PolicyAssignInput = z.infer<typeof policyAssignSchema>;

export const policyListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  type: policyTypeEnum.optional(),
  isActive: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
  includeAssignments: z.enum(['true', 'false']).optional().default('false').transform((v) => v === 'true'),
});
export type PolicyListQueryInput = z.infer<typeof policyListQuerySchema>;
