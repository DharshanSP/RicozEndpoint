import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const userRoleEnum = z.enum([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'IT_ADMIN',
  'OPERATOR',
  'VIEWER',
]);

export type UserRoleType = z.infer<typeof userRoleEnum>;

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: userRoleEnum.default('VIEWER'),
  organizationId: z.string().uuid('Invalid Organization ID').optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: userRoleEnum.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Password policy applied to every self-service or admin-set password.
 * Mirrors the seed/demo credentials minimum of 8 characters.
 */
export const passwordPolicySchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordPolicySchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const adminResetPasswordSchema = z.object({
  newPassword: passwordPolicySchema,
});

export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

/**
 * Public tenant signup: creates a brand-new organization with the registrant
 * in a workspace role. Only operational roles may self-select — administrative
 * roles (ORG_ADMIN / SUPER_ADMIN) are granted solely by an administrator
 * inside an organization.
 */
export const selfServiceRoleEnum = z.enum(['IT_ADMIN', 'OPERATOR', 'VIEWER']);

export type SelfServiceRoleType = z.infer<typeof selfServiceRoleEnum>;

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2, 'Organization name is required').max(120),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().email('Invalid email address'),
  password: passwordPolicySchema,
  role: selfServiceRoleEnum.default('VIEWER'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
