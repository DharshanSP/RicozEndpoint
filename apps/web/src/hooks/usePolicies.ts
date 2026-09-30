import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignPolicy,
  createPolicy,
  deletePolicy,
  listPolicies,
  updatePolicy,
  type PolicyListQuery,
} from '../lib/api/policiesApi';
import type {
  AssignPolicyPayload,
  CreatePolicyPayload,
  PolicyListResponse,
  UpdatePolicyPayload,
} from '../types/policy';

export function usePoliciesList(query: PolicyListQuery = {}) {
  return useQuery({
    queryKey: ['policies', 'list', query],
    queryFn: (): Promise<PolicyListResponse> => listPolicies(query),
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePolicyPayload) => createPolicy(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['policies', 'list'] });
    },
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePolicyPayload }) =>
      updatePolicy(id, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['policies', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['policies', 'detail', variables.id] });
    },
  });
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePolicy(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['policies', 'list'] });
    },
  });
}

export function useAssignPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AssignPolicyPayload }) =>
      assignPolicy(id, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['policies', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['policies', 'detail', variables.id] });
    },
  });
}