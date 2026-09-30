import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(120),
  /**
   * Optional bootstrap administrator for the new organization.
   * When omitted the organization is created empty and users are invited later.
   */
  admin: z
    .object({
      email: z.string().email('Invalid email address'),
      name: z.string().min(2, 'Name must be at least 2 characters'),
      password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    })
    .optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  settingsJson: z.record(z.unknown()).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const organizationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).optional(),
});

export type OrganizationListQueryInput = z.infer<typeof organizationListQuerySchema>;
