import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/config/env';
import i18n from '@/i18n';
import { ApiError, type ApiErrorBody } from './types';

/**
 * Axios instance for the SBay backend.
 *
 * Security model (matches backend):
 * - Auth tokens live in HttpOnly cookies → `withCredentials: true` on every call;
 *   JS never reads or stores tokens.
 * - Unsafe methods (POST/PATCH/DELETE) require a CSRF double-submit token from
 *   GET /auth/csrf-token sent back in the `x-csrf-token` header. We cache it and
 *   refresh on demand / on CSRF rejection.
 * - On 401 for a non-auth request, we attempt a single refresh (single-flight)
 *   then replay the original request.
 */

const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

let csrfToken: string | null = null;
let csrfInFlight: Promise<string> | null = null;
let refreshInFlight: Promise<void> | null = null;

/** Called when refresh fails — lets the app clear auth state / redirect. */
let onAuthExpired: (() => void) | null = null;
export function setOnAuthExpired(handler: () => void) {
  onAuthExpired = handler;
}

// Bare axios (no interceptors) for the CSRF + refresh calls to avoid recursion.
const bare = axios.create({ baseURL: env.apiBaseUrl, withCredentials: true });

async function fetchCsrfToken(): Promise<string> {
  if (csrfInFlight) return csrfInFlight;
  csrfInFlight = bare
    .get<{ data: { csrfToken: string } }>('/auth/csrf-token')
    .then((res) => {
      csrfToken = res.data.data.csrfToken;
      return csrfToken;
    })
    .finally(() => {
      csrfInFlight = null;
    });
  return csrfInFlight;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
});

// Request: attach CSRF token to unsafe methods.
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (UNSAFE_METHODS.has(method)) {
    const token = csrfToken ?? (await fetchCsrfToken());
    config.headers.set('x-csrf-token', token);
  }
  return config;
});

async function runRefresh(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const token = csrfToken ?? (await fetchCsrfToken());
    await bare.post('/auth/refresh', null, { headers: { 'x-csrf-token': token } });
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

// Response: unwrap envelope; handle 401 refresh + CSRF (403) retry; normalize errors.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const body = error.response?.data;
    const url = original?.url ?? '';
    const isAuthRoute = url.includes('/auth/');
    // The "am I logged in?" probe: a guest 401 here is normal, not an expired
    // session — don't chase it with a refresh (which would just 401 again and
    // spam the console with two errors instead of one).
    const isSessionProbe = url.includes('/users/me');

    // Stale CSRF token → refresh token once and retry the unsafe request.
    if (status === 403 && body?.error?.code === 'INVALID_CSRF' && original && !original._retry) {
      original._retry = true;
      csrfToken = null;
      const token = await fetchCsrfToken();
      original.headers.set('x-csrf-token', token);
      return apiClient(original);
    }

    // Expired access token → single-flight refresh, then replay.
    if (status === 401 && original && !original._retry && !isAuthRoute && !isSessionProbe) {
      original._retry = true;
      try {
        await runRefresh();
        return apiClient(original);
      } catch {
        onAuthExpired?.();
      }
    }

    if (body?.error) {
      throw new ApiError(body.error.code, body.error.message, status ?? 0, body.error.details);
    }
    throw new ApiError('NETWORK_ERROR', error.message || i18n.t('common.connectionError'), status ?? 0);
  },
);

/**
 * Guard against a malformed response body. If a request somehow returns a
 * non-envelope payload (e.g. an HTML SPA-fallback page when the API base URL is
 * misconfigured, or a proxy error), `data` is undefined — surface that as a
 * clear error instead of letting `undefined` reach React Query (which throws
 * "Query data cannot be undefined" and crashes the tree).
 */
function ensureData<T>(value: T | undefined, url: string): T {
  if (value === undefined) {
    throw new ApiError(
      'MALFORMED_RESPONSE',
      `Unexpected response from ${url} — the API did not return a data envelope.`,
      0,
    );
  }
  return value;
}

/** Unwrap `{ success, data, meta }` → returns `data` (and optionally meta). */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<{ data: T }>(url, { params });
  return ensureData(res.data?.data, url);
}

export async function apiGetPaged<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<{ items: T[]; meta: import('./types').PaginationMeta }> {
  const res = await apiClient.get<{ data: T[]; meta: import('./types').PaginationMeta }>(url, {
    params,
  });
  return { items: ensureData(res.data?.data, url), meta: res.data?.meta };
}

export async function apiMutate<T>(
  method: 'post' | 'patch' | 'delete',
  url: string,
  data?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await apiClient.request<{ data: T }>({ method, url, data, headers });
  return res.data?.data;
}

/** Invalidate the cached CSRF token (e.g. after logout). */
export function clearCsrfToken() {
  csrfToken = null;
}
