import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acknowledgeAlert, batchResolveAlerts, listAlerts, resolveAlert } from '../lib/api/alertsApi';
import type {
  AlertListQuery,
  AlertListResponse,
  BatchResolveAlertPayload,
  ResolveAlertPayload,
} from '../types/alert';

export function useAlertsList(query: AlertListQuery = {}) {
  return useQuery({
    queryKey: ['alerts', 'list', query],
    queryFn: (): Promise<AlertListResponse> => listAlerts(query),
  });
}

function useInvalidateAlerts() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useResolveAlert() {
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ResolveAlertPayload }) =>
      resolveAlert(id, payload),
    onSuccess: invalidate,
  });
}

export function useAcknowledgeAlert() {
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: (id: string) => acknowledgeAlert(id),
    onSuccess: invalidate,
  });
}

export function useBatchResolveAlerts() {
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: (payload: BatchResolveAlertPayload) => batchResolveAlerts(payload),
    onSuccess: invalidate,
  });
}
