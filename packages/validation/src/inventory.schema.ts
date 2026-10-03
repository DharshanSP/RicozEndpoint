import { z } from 'zod';

export const hardwareInventorySchema = z.object({
  hostname: z.string(),
  cpu: z.string(),
  cpuCores: z.number().int().positive(),
  ramBytes: z.number().int().positive(),
  storageBytes: z.number().int().positive(),
  freeStorageBytes: z.number().int().nonnegative().optional(),
  manufacturer: z.string(),
  model: z.string(),
  serialNumber: z.string(),
  biosVersion: z.string(),
  os: z.string(),
  osVersion: z.string(),
  architecture: z.string(),
});

export type HardwareInventoryInput = z.infer<typeof hardwareInventorySchema>;

export const softwareItemSchema = z.object({
  name: z.string(),
  version: z.string(),
  publisher: z.string(),
  installDate: z.string().nullable(),
  architecture: z.string(),
});

export type SoftwareItemInput = z.infer<typeof softwareItemSchema>;

export const softwareInventorySchema = z.object({
  items: z.array(softwareItemSchema),
});

export type SoftwareInventoryInput = z.infer<typeof softwareInventorySchema>;

export const patchItemSchema = z.object({
  kbNumber: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  installedAt: z.string().nullable().optional(),
});

export type PatchItemInput = z.infer<typeof patchItemSchema>;

export const patchInventorySchema = z.object({
  items: z.array(patchItemSchema),
});

export type PatchInventoryInput = z.infer<typeof patchInventorySchema>;