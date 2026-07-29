import { beginRequest, endRequest } from './api-activity';
import { getToken } from './auth/token';
import { logFailure, logRequest, logResponse } from './log';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

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

export interface ApiFetchOptions extends RequestInit {
  // Background enrichment calls (e.g. theme generation) that shouldn't make
  // the global loading indicator appear over an already-rendered page.
  silent?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { silent, ...fetchOptions } = options;
  const token = getToken();
  const headers = new Headers(fetchOptions.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const method = fetchOptions.method ?? 'GET';
  logRequest(method, path, fetchOptions.body);

  if (!silent) beginRequest();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
  } catch (error) {
    // fetch only rejects when no response arrived at all — DNS, connection
    // refused, or a CORS block. None of those reach the server, so this is the
    // only place they're visible.
    if (!isAbortError(error)) logFailure(method, `${API_URL}${path}`, error);
    throw error;
  } finally {
    if (!silent) endRequest();
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    logResponse(method, path, response.status, body);
    throw new ApiError(response.status, body.error ?? response.statusText);
  }

  if (response.status === 204) {
    logResponse(method, path, response.status);
    return undefined as T;
  }

  const data = await response.json();
  logResponse(method, path, response.status, data);
  return data as T;
}
