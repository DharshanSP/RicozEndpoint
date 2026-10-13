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

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserListPage {
  items: UserSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listUsers(params: UserListParams = {}): Promise<UserListPage> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive));

  const search = query.toString();
  const res = await fetchApi<UserListPage>(`/users${search ? `?${search}` : ''}`);
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? 'Failed to retrieve organization users');
  }
  return res.data;
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
