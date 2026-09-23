import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAlerts, resolveAlert } from '../lib/api/alertsApi';
import type { AlertListQuery, AlertListResponse, ResolveAlertPayload } from '../types/alert';

export function useAlertsList(query: AlertListQuery = {}) {
  return useQuery({
    queryKey: ['alerts', 'list', query],
    queryFn: (): Promise<AlertListResponse> => listAlerts(query),
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ResolveAlertPayload }) =>
      resolveAlert(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts', 'list'] });
    },
  });
}