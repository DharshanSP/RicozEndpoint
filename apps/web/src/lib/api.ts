const rawBaseUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/** Normalized API base URL (no trailing slash) shared by UI snippets and requests. */
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
export const apiBaseUrl = API_BASE_URL;

/** Fired when the API rejects the current session (401) so auth state can be cleared. */
export const UNAUTHORIZED_EVENT = 'ricoz:unauthorized';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  error?: { code: string; message: string };
}

async function parseBody(res: Response): Promise<ApiEnvelope<unknown> | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiEnvelope<unknown>;
  } catch {
    return null;
  }
}

export async function fetchApi<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiEnvelope<T>> {
  const token = localStorage.getItem('ricoz_auth_token');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await parseBody(res);

    if (!res.ok) {
      if (res.status === 401 && !endpoint.startsWith('/auth/login')) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      return {
        success: false,
        error: data?.error ?? {
          code: 'HTTP_ERROR',
          message: `Server error: ${res.status}`,
        },
      };
    }

    if (!data) {
      return { success: true };
    }

    return data as ApiEnvelope<T>;
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network communication failed',
      },
    };
  }
}
