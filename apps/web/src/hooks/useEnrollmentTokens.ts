import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveEnrollmentTokenRequest,
  cancelEnrollmentTokenRequest,
  createEnrollmentToken,
  createEnrollmentTokenRequest,
  denyEnrollmentTokenRequest,
  listEnrollmentHistory,
  listEnrollmentTokenRequests,
  listEnrollmentTokens,
  revealEnrollmentTokenRequestToken,
  revokeEnrollmentToken,
} from '../lib/api/enrollmentTokensApi';
import type {
  CreateEnrollmentTokenPayload,
  CreateEnrollmentTokenRequestPayload,
  EnrollmentHistoryEntry,
  EnrollmentTokenListQuery,
  EnrollmentTokenListResponse,
  EnrollmentTokenRequestListQuery,
  EnrollmentTokenRequestListResponse,
} from '../types/enrollment';

export function useEnrollmentTokenList(query: EnrollmentTokenListQuery = {}, enabled = true) {
  return useQuery({
    queryKey: ['enrollment-tokens', 'list', query],
    queryFn: (): Promise<EnrollmentTokenListResponse> => listEnrollmentTokens(query),
    enabled,
  });
}

/** Enrollment history derived from issued agent tokens (re-enrollments included). */
export function useEnrollmentHistory(limit = 25, enabled = true) {
  return useQuery({
    queryKey: ['enrollment-tokens', 'history', limit],
    queryFn: (): Promise<EnrollmentHistoryEntry[]> => listEnrollmentHistory({ limit }),
    enabled,
  });
}

export function useEnrollmentTokenRequests(query: EnrollmentTokenRequestListQuery = {}) {
  return useQuery({
    queryKey: ['enrollment-token-requests', 'list', query],
    queryFn: (): Promise<EnrollmentTokenRequestListResponse> => listEnrollmentTokenRequests(query),
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

export function useCreateEnrollmentTokenRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEnrollmentTokenRequestPayload) => createEnrollmentTokenRequest(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-token-requests'] });
    },
  });
}

export function useApproveEnrollmentTokenRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adminNote }: { id: string; adminNote?: string }) =>
      approveEnrollmentTokenRequest(id, { adminNote }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-token-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['enrollment-tokens', 'list'] });
    },
  });
}

export function useDenyEnrollmentTokenRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adminNote }: { id: string; adminNote?: string }) =>
      denyEnrollmentTokenRequest(id, { adminNote }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-token-requests'] });
    },
  });
}

export function useCancelEnrollmentTokenRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelEnrollmentTokenRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-token-requests'] });
    },
  });
}

export function useRevealEnrollmentTokenRequestToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revealEnrollmentTokenRequestToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-token-requests'] });
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