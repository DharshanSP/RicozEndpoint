import { z } from 'zod';

export const softwareCatalogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'publisher', 'deviceCount']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type SoftwareCatalogQueryInput = z.infer<typeof softwareCatalogQuerySchema>;