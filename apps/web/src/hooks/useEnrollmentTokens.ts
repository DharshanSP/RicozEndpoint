import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEnrollmentToken,
  listEnrollmentTokens,
  revokeEnrollmentToken,
} from '../lib/api/enrollmentTokensApi';
import type {
  CreateEnrollmentTokenPayload,
  EnrollmentTokenListQuery,
  EnrollmentTokenListResponse,
} from '../types/enrollment';

export function useEnrollmentTokenList(query: EnrollmentTokenListQuery = {}) {
  return useQuery({
    queryKey: ['enrollment-tokens', 'list', query],
    queryFn: (): Promise<EnrollmentTokenListResponse> => listEnrollmentTokens(query),
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