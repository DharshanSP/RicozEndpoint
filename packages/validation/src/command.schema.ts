import { z } from 'zod';
import { commandResultSchema } from './agent.schema.js';

export const commandTypeEnum = z.enum([
  'REFRESH_INVENTORY',
  'SYNC_POLICY',
  'INSTALL_PATCH',
  'INSTALL_APPLICATION',
  'UNINSTALL_APPLICATION',
  'LOCK_DEVICE',
  'RESTART_DEVICE',
  'SHUTDOWN_DEVICE',
]);

export type CommandType = z.infer<typeof commandTypeEnum>;

const DESTRUCTIVE_COMMANDS: CommandType[] = ['LOCK_DEVICE', 'RESTART_DEVICE', 'SHUTDOWN_DEVICE'];

export const createCommandSchema = z
  .object({
    deviceId: z.string().uuid(),
    type: commandTypeEnum,
    confirmed: z.boolean().default(false),
    params: z.record(z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    if (DESTRUCTIVE_COMMANDS.includes(val.type) && !val.confirmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Command type ${val.type} requires confirmed: true`,
        path: ['confirmed'],
      });
    }
    if (val.type === 'INSTALL_APPLICATION') {
      const url = val.params?.installerUrl;
      if (typeof url !== 'string' || url.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'INSTALL_APPLICATION requires params.installerUrl',
          path: ['params', 'installerUrl'],
        });
      }
    }
    if (val.type === 'UNINSTALL_APPLICATION') {
      const name = val.params?.name;
      if (typeof name !== 'string' || name.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'UNINSTALL_APPLICATION requires params.name',
          path: ['params', 'name'],
        });
      }
    }
  });

export type CreateCommandInput = z.infer<typeof createCommandSchema>;

export const commandParamsSchema = z.object({
  id: z.string().uuid('Invalid command id'),
});

export const commandListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  deviceId: z.string().uuid().optional(),
  type: commandTypeEnum.optional(),
  status: z.enum(['QUEUED', 'SENT', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
});
export type CommandListQueryInput = z.infer<typeof commandListQuerySchema>;

export const commandResultsBulkSchema = z.object({
  results: z.array(z.object({ commandId: z.string().uuid(), ...commandResultSchema.shape })).min(1).max(50),
});
export type CommandResultsBulkInput = z.infer<typeof commandResultsBulkSchema>;
