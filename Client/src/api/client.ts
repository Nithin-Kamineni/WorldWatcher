/** Thin fetch wrapper for the WorldWatcher FastAPI backend. Every
 * resource module in src/api/ builds on these four functions instead of
 * calling fetch() directly, so error handling and base-URL config stay
 * in exactly one place. */

/** Falls back to the page's own origin (via the client container's nginx
 * reverse proxy) so the built image works from any host - LAN IP, phone,
 * etc - without baking in a fixed URL at build time. Local `npm run dev`
 * keeps using the explicit URL from .env instead, since there's no proxy
 * in front of the Vite dev server. */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? `${window.location.origin}/api`).replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(API_BASE_URL + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  options: { params?: QueryParams; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { params, body, signal } = options;
  const res = await fetch(buildUrl(path, params), {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const record = data as { detail?: unknown; error?: unknown } | undefined;
    const rawMessage = record?.detail ?? record?.error ?? res.statusText;
    const message = typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage);
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

export const apiGet = <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
  request<T>('GET', path, { params, signal });

export const apiPost = <T>(path: string, body?: unknown, params?: QueryParams) =>
  request<T>('POST', path, { body, params });

export const apiPatch = <T>(path: string, body: unknown) => request<T>('PATCH', path, { body });

export const apiDelete = (path: string) => request<void>('DELETE', path);

/** Multipart upload (used only for POST /assets/upload). */
export async function apiUpload<T>(path: string, file: File, fields: QueryParams = {}): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(buildUrl(path, fields), { method: 'POST', body: form });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const record = data as { detail?: unknown } | undefined;
    const rawMessage = record?.detail ?? res.statusText;
    throw new ApiError(res.status, typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage), data);
  }
  return data as T;
}

export interface PageMeta {
  total: number;
  limit: number;
  offset: number;
  count: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export function assetFileUrl(assetId: string | null | undefined): string {
  if (!assetId) return '';
  return `${API_BASE_URL}/assets/${assetId}/file`;
}
