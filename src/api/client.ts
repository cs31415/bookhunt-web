const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const LOG_API_CALLS = import.meta.env.VITE_LOG_API_CALLS === 'true';

// Kept in sync with the key useAuth (added in Ticket 1C) writes the JWT under.
const TOKEN_STORAGE_KEY = 'bookhunt_token';

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const method = options.method ?? 'GET';
  if (LOG_API_CALLS) {
    console.log(`[api] → ${method} ${path}`, options.body ?? '');
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    if (LOG_API_CALLS) {
      console.log(`[api] ← ${method} ${path} ${response.status}`, body);
    }
    throw new ApiError(response.status, body.error ?? response.statusText);
  }

  if (response.status === 204) {
    if (LOG_API_CALLS) console.log(`[api] ← ${method} ${path} ${response.status}`);
    return undefined as T;
  }

  const data = await response.json();
  if (LOG_API_CALLS) console.log(`[api] ← ${method} ${path} ${response.status}`, data);
  return data as T;
}
