import { getApiBaseUrl } from '../config/api-base-url.js';

export interface CallApiOptions {
  method: string;
  /** Path below the API base, query string included, e.g. `/library?page=2`. */
  path: string;
  /** Attached as a Bearer header when present. */
  token?: string;
  /** Passed on as X-Forwarded-For so the API rate-limits per reader, not per BFF. */
  clientIp?: string;
  contentType?: string;
  body?: Buffer;
}

/**
 * The one place the BFF talks to the bookhunt API.
 *
 * Both the generic forwarder and the cookie-setting auth routes go through
 * here, so header handling has a single definition.
 */
export function callApi(options: CallApiOptions): Promise<Response> {
  const headers = new Headers();
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.contentType) headers.set('Content-Type', options.contentType);
  if (options.clientIp) headers.set('X-Forwarded-For', options.clientIp);

  return fetch(`${getApiBaseUrl()}${options.path}`, {
    method: options.method,
    headers,
    // A zero-length body is not the same as no body: sending one on a GET is a
    // protocol error, and Express reads `Content-Length: 0` with a JSON
    // content-type as a malformed document.
    body: options.body && options.body.length > 0 ? new Uint8Array(options.body) : undefined,
  });
}
