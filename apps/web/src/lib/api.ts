const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Deployed API used when no NEXT_PUBLIC_API_URL override is present. */
const DEPLOYED_API_URL = 'https://ricoz-api.onrender.com/api';
const LOCAL_API_URL = 'http://localhost:3001/api';

const servedLocally =
  typeof window === 'undefined' || LOCAL_HOSTS.has(window.location.hostname);

const rawBaseUrl: string = process.env.NEXT_PUBLIC_API_URL || (servedLocally ? LOCAL_API_URL : DEPLOYED_API_URL);

/** Normalized API base URL (no trailing slash) shared by UI snippets and requests. */
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
export const apiBaseUrl = API_BASE_URL;

/**
 * True when this deployment points at a local API (e.g. NEXT_PUBLIC_API_URL was
 * set to localhost for a hosted build), so requests would fail with "Failed to fetch".
 */
export const API_BASE_URL_MISCONFIGURED = (() => {
  if (typeof window === 'undefined') return false;
  if (LOCAL_HOSTS.has(window.location.hostname)) return false;
  try {
    return LOCAL_HOSTS.has(new URL(API_BASE_URL).hostname);
  } catch {
    return true;
  }
})();

const MISCONFIGURED_MESSAGE =
  'API base URL points at localhost for this deployment. Set NEXT_PUBLIC_API_URL ' +
  '(e.g. https://ricoz-api.onrender.com/api) in your hosting environment and redeploy — ' +
  'it is baked in at build time.';

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
  if (API_BASE_URL_MISCONFIGURED) {
    return {
      success: false,
      error: { code: 'CONFIG_ERROR', message: MISCONFIGURED_MESSAGE },
    };
  }

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
