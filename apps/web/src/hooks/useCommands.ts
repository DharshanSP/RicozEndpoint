import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCommand } from '../lib/api/commandsApi';
import type { CreateCommandPayload } from '../types/command';

export function useCreateCommand(deviceId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCommandPayload) => createCommand(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices', 'detail', deviceId] });
      void queryClient.invalidateQueries({ queryKey: ['commands', 'list'] });
    },
  });
}