import { z } from 'zod';

export const softwareCatalogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'publisher', 'deviceCount']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type SoftwareCatalogQueryInput = z.infer<typeof softwareCatalogQuerySchema>;

export const softwareDeployTargetEnum = z.enum(['DEVICE', 'GROUP']);
export type SoftwareDeployTarget = z.infer<typeof softwareDeployTargetEnum>;

export const softwareDeployActionEnum = z.enum(['INSTALL', 'UNINSTALL']);
export type SoftwareDeployAction = z.infer<typeof softwareDeployActionEnum>;

export const softwareDeploySchema = z
  .object({
    applicationId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(255),
    version: z.string().trim().min(1).max(64).default('1.0.0'),
    publisher: z.string().trim().max(255).optional(),
    installerUrl: z
      .string()
      .trim()
      .max(2048)
      .refine((value) => value === '' || /^https?:\/\//i.test(value), {
        message: 'installerUrl must be an http(s) URL',
      })
      .optional(),
    silentArgs: z.string().trim().max(512).optional(),
    targetType: softwareDeployTargetEnum,
    targetId: z.string().uuid(),
    action: softwareDeployActionEnum.default('INSTALL'),
    confirmed: z.boolean().default(false),
    deviceIds: z.array(z.string().uuid()).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.confirmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Software deployment requires confirmed: true',
        path: ['confirmed'],
      });
    }
    if (value.action === 'INSTALL' && value.installerUrl && !/^https?:\/\//i.test(value.installerUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'installerUrl must be an http(s) URL',
        path: ['installerUrl'],
      });
    }
  });

export type SoftwareDeployInput = z.infer<typeof softwareDeploySchema>;

export const softwareDeploymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  action: softwareDeployActionEnum.optional(),
  applicationId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
});

export type SoftwareDeploymentsQueryInput = z.infer<typeof softwareDeploymentsQuerySchema>;

export const softwareParamsSchema = z.object({
  id: z.string().uuid('Invalid deployment id'),
});
export type SoftwareParamsInput = z.infer<typeof softwareParamsSchema>;
