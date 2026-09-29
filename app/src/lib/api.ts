import { API_URL } from './config';
import { storage } from './storage';
import type { Tokens } from './types';

const ACCESS = 'vt_access';
const REFRESH = 'vt_refresh';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export const tokens = {
  save: async (t: Tokens) => {
    await storage.set(ACCESS, t.access_token);
    await storage.set(REFRESH, t.refresh_token);
  },
  clear: async () => {
    await storage.remove(ACCESS);
    await storage.remove(REFRESH);
  },
  access: () => storage.get(ACCESS),
};

/** Convierte el "detail" de FastAPI (texto o lista de errores de validación) en un mensaje legible. */
function errorMessage(body: any, status: number): string {
  const d = body?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d
      .map((e) => {
        const field = Array.isArray(e.loc) ? e.loc.filter((x: any) => x !== 'body').join('.') : '';
        return field ? `${field}: ${e.msg}` : e.msg;
      })
      .join('\n');
  }
  return `Error ${status}`;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Un solo refresh a la vez aunque varias peticiones fallen juntas
  refreshing ??= (async () => {
    const refresh = await storage.get(REFRESH);
    if (!refresh) return false;
    try {
      const r = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!r.ok) return false;
      await tokens.save(await r.json());
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type Query = Record<string, string | number | boolean | null | undefined>;

async function request<T>(method: string, path: string, body?: unknown, query?: Query, retry = true): Promise<T> {
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const token = await tokens.access();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API_URL}). ¿Está encendido el backend?`);
  }

  if (res.status === 401 && token && retry) {
    if (await tryRefresh()) return request<T>(method, path, body, query, false);
    await tokens.clear();
    onUnauthorized?.();
  }
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(data, res.status));
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
