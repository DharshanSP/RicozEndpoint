import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEnrollmentToken,
  listEnrollmentHistory,
  listEnrollmentTokens,
  revokeEnrollmentToken,
} from '../lib/api/enrollmentTokensApi';
import type {
  CreateEnrollmentTokenPayload,
  EnrollmentHistoryEntry,
  EnrollmentTokenListQuery,
  EnrollmentTokenListResponse,
} from '../types/enrollment';

export function useEnrollmentTokenList(query: EnrollmentTokenListQuery = {}) {
  return useQuery({
    queryKey: ['enrollment-tokens', 'list', query],
    queryFn: (): Promise<EnrollmentTokenListResponse> => listEnrollmentTokens(query),
  });
}

/** Enrollment history derived from issued agent tokens (re-enrollments included). */
export function useEnrollmentHistory(limit = 25) {
  return useQuery({
    queryKey: ['enrollment-tokens', 'history', limit],
    queryFn: (): Promise<EnrollmentHistoryEntry[]> => listEnrollmentHistory({ limit }),
  });
}

export function useCreateEnrollmentToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEnrollmentTokenPayload) => createEnrollmentToken(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-tokens', 'list'] });
    },
  });
}

export function useRevokeEnrollmentToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeEnrollmentToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-tokens', 'list'] });
    },
  });
}