import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listUsers,
  createUser,
  updateUser,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserSummary,
} from '../lib/api/usersApi';

export function useUsersList() {
  return useQuery({
    queryKey: ['users', 'list'],
    queryFn: (): Promise<UserSummary[]> => listUsers(),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      updateUser(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
    },
  });
}
