import { z } from 'zod';

export const organizationSettingsSchema = z.object({
  agentHeartbeatIntervalSeconds: z
    .number()
    .int()
    .min(10)
    .max(86400)
    .default(60),
  offlineTimeoutMinutes: z.number().int().min(1).max(10080).default(15),
  alertRetentionDays: z.number().int().min(1).max(3650).default(30),
  auditRetentionDays: z.number().int().min(1).max(3650).default(365),
  defaultPolicyPriority: z.number().int().min(0).max(1000).default(100),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

export const updateOrganizationSettingsSchema = organizationSettingsSchema.partial();

export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;