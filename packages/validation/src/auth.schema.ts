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
