import { API_BASE_URL, USER_ID_STORAGE_KEY } from './constants';

export function getUserId() {
  if (typeof window === 'undefined') return 'unknown';
  const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (stored) return stored;
  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(USER_ID_STORAGE_KEY, generated);
  return generated;
}

export function resolveApiUrl(path: string) {
  if (!API_BASE_URL) return path;
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}${path}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set('X-User-Id', getUserId());
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const url = resolveApiUrl(path);
  console.log(`[DEBUG] apiFetch: ${options.method || 'GET'} ${url}`, { userId: getUserId(), path, API_BASE_URL });
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }
  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
}
