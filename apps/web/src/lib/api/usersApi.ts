import { fetchApi } from '../api';

export interface UserItem {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'IT_ADMIN' | 'OPERATOR' | 'VIEWER';
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt?: string;
}

export async function getUsers() {
  return fetchApi<UserItem[]>('/users');
}

export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  role: string;
}) {
  return fetchApi<UserItem>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(
  id: string,
  data: { name?: string; role?: string; isActive?: boolean }
) {
  return fetchApi<UserItem>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
