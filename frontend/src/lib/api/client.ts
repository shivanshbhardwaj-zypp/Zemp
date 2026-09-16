import {
  ERROR_MESSAGES,
  type ApiFailure,
  type ApiSuccess,
  type ErrorCode,
  type Page,
  type ValidationDetails,
} from '@zemp/shared';

/**
 * The single place the browser talks to the API (Frontend.md §96). Requests go to same-origin
 * /api/v1, so the HttpOnly session cookie travels automatically and never touches JavaScript.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ValidationDetails | undefined;

  constructor(status: number, code: ErrorCode, message: string, details?: ValidationDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type QueryValue = string | number | boolean | null | undefined | readonly string[];
export type Query = Record<string, QueryValue>;

const CSRF_COOKIE = 'zemp_csrf';
const unauthorizedListeners = new Set<(error: ApiError) => void>();

/** Lets the session layer react to an expired session without losing the page underneath. */
export function onUnauthorized(listener: (error: ApiError) => void) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function readCsrfToken() {
  const prefix = `${CSRF_COOKIE}=`;
  const cookie = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
}

export function toQueryString(query?: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(method: string, path: string, query?: Query, body?: unknown) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = readCsrfToken();

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}${toQueryString(query)}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'INTERNAL_ERROR', 'ZEMP could not be reached. Check your connection and try again.');
  }

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;
  if (response.ok && payload?.success) return payload;

  const failure = payload && !payload.success ? payload.error : undefined;
  const code = failure?.code ?? 'INTERNAL_ERROR';
  const error = new ApiError(response.status, code, failure?.message ?? ERROR_MESSAGES[code], failure?.details);
  const isSignIn = path === '/auth/login' || path === '/auth/me';
  if (response.status === 401 && !isSignIn) unauthorizedListeners.forEach((listener) => listener(error));
  throw error;
}

export const api = {
  get: async <T>(path: string, query?: Query) => (await request<T>('GET', path, query)).data,
  page: async <T>(path: string, query?: Query): Promise<Page<T>> => {
    const { data, meta } = await request<T[]>('GET', path, query);
    return { items: data, meta: meta ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 } };
  },
  post: async <T>(path: string, body: unknown = {}) => (await request<T>('POST', path, undefined, body)).data,
  patch: async <T>(path: string, body: unknown) => (await request<T>('PATCH', path, undefined, body)).data,
};
