import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  evaluateCompliance,
  getComplianceRollup,
  getDeviceCompliance,
  type ComplianceDetailQuery,
  type ComplianceRollupQuery,
} from '../lib/api/complianceApi';
import type {
  ComplianceDeviceDetailResponse,
  ComplianceRollupResponse,
  EvaluateCompliancePayload,
  EvaluateComplianceResult,
} from '../types/compliance';

/** Fleet compliance rollup for the Compliance overview page. */
export function useComplianceRollup(query: ComplianceRollupQuery = {}) {
  return useQuery({
    queryKey: ['compliance', 'rollup', query],
    queryFn: (): Promise<ComplianceRollupResponse> => getComplianceRollup(query),
  });
}

/** Per-device compliance summary, checks and history. */
export function useDeviceCompliance(deviceId: string | undefined, query: ComplianceDetailQuery = {}) {
  return useQuery({
    queryKey: ['compliance', 'device', deviceId, query],
    queryFn: (): Promise<ComplianceDeviceDetailResponse> => getDeviceCompliance(deviceId!, query),
    enabled: Boolean(deviceId),
  });
}

/** Manually re-runs evaluation, then refreshes the rollup and device views. */
export function useEvaluateCompliance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EvaluateCompliancePayload): Promise<EvaluateComplianceResult> =>
      evaluateCompliance(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compliance'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}
