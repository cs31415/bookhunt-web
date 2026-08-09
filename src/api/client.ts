import { beginRequest, endRequest } from './api-activity';
import { notifySessionExpired } from './auth/session-expired';
import { clearStoredUser } from './auth/stored-user';
import { logFailure, logRequest, logResponse } from './log';

// The BFF (LOS-119), not the bookhunt API. A same-origin path by default, so
// the browser makes no cross-origin request and the session cookie needs no
// exemption; Vite proxies it to the BFF process in dev.
const BFF_URL = import.meta.env.VITE_BFF_URL ?? '/bff';

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
  const headers = new Headers(fetchOptions.headers);
  headers.set('Content-Type', 'application/json');

  const method = fetchOptions.method ?? 'GET';
  logRequest(method, path, fetchOptions.body);

  if (!silent) beginRequest();
  let response: Response;
  try {
    // No Authorization header: the session is an httpOnly cookie the browser
    // attaches itself, and nothing here can read it. `include` rather than the
    // default so a BFF configured on another origin still works.
    response = await fetch(`${BFF_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    // fetch only rejects when no response arrived at all — DNS, connection
    // refused, or a CORS block. None of those reach the server, so this is the
    // only place they're visible.
    if (!isAbortError(error)) logFailure(method, `${BFF_URL}${path}`, error);
    throw error;
  } finally {
    if (!silent) endRequest();
  }

  if (!response.ok) {
    if (response.status === 401) forgetExpiredSession(path);
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

/**
 * The cached user outlives the cookie — nothing tells the app the moment a
 * session expires, so without this the UI would keep showing a signed-in
 * reader until they happened to reload.
 *
 * Sign-in attempts are exempt: a 401 there means the password was wrong, and is
 * the caller's to report.
 */
function forgetExpiredSession(path: string): void {
  if (path.startsWith('/auth/')) return;
  clearStoredUser();
  notifySessionExpired();
}
