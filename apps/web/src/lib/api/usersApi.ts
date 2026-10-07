import { fetchApi } from '../api';
import type { UserRole } from '../../context/AuthContext';

export type { UserRole };

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt?: string;
}

export type UserItem = UserSummary;

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

export async function listUsers(): Promise<UserSummary[]> {
  const res = await fetchApi<UserSummary[]>('/users');
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? 'Failed to retrieve organization users');
  }
  return res.data;
}

export async function getUsers() {
  return fetchApi<UserSummary[]>('/users');
}

export async function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  const res = await fetchApi<UserSummary>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? 'Failed to create user');
  }
  return res.data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserSummary> {
  const res = await fetchApi<UserSummary>(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? 'Failed to update user');
  }
  return res.data;
}

export async function deleteUser(id: string): Promise<{ id: string; email: string }> {
  const res = await fetchApi<{ id: string; email: string }>(`/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? 'Failed to delete user');
  }
  return res.data;
}
