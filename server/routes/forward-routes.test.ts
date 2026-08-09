import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../create-app.js';
import { FORWARD_ROUTES } from './forward-manifest.js';

const API = 'http://api.test/api';

/**
 * Drives the app over a real loopback socket rather than a request mock, so
 * what is asserted is what a browser would actually see — status line, headers
 * and body included.
 */
async function request(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<Response> {
  const { cookie, ...rest } = init;
  const server = createApp().listen(0);
  try {
    const { port } = server.address() as { port: number };
    const headers = new Headers(rest.headers);
    if (cookie) headers.set('Cookie', cookie);
    // Every route behind requireSameOrigin needs what a browser would send.
    if (!headers.has('Sec-Fetch-Site')) headers.set('Sec-Fetch-Site', 'same-origin');
    return await fetch(`http://127.0.0.1:${port}${path}`, { ...rest, headers });
  } finally {
    server.close();
  }
}

/** The last URL, method and headers the app sent to the API. */
function apiCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0];
  return { url: String(url), method: init.method, headers: init.headers as Headers };
}

/** Would `pattern` match `literal`, i.e. does it differ only in parameters? */
function shadows(pattern: string, literal: string): boolean {
  const patternSegments = pattern.split('/');
  const literalSegments = literal.split('/');
  if (patternSegments.length !== literalSegments.length) return false;
  return patternSegments.every(
    (segment, index) => segment.startsWith(':') || segment === literalSegments[index],
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;

beforeEach(() => {
  process.env.API_BASE_URL = API;
  fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
  // Only calls aimed at the API are intercepted; the loopback request the test
  // itself makes has to go through for real.
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith(API)
      ? fetchMock(input, init)
      : realFetch(input, init)) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.API_BASE_URL;
});

describe('the forwarding manifest', () => {
  it('reaches the API with the session as a Bearer token', async () => {
    await request('/bff/library?page=2', { cookie: 'bh_session=jwt-123' });

    const { url, headers } = apiCall(fetchMock);
    expect(url).toBe(`${API}/library?page=2`);
    expect(headers.get('Authorization')).toBe('Bearer jwt-123');
  });

  it('rejects an auth-required route without ever calling the API', async () => {
    const response = await request('/bff/library');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards an optional-auth route for a signed-out reader', async () => {
    const response = await request('/bff/canned-searches');

    expect(response.status).toBe(200);
    expect(apiCall(fetchMock).headers.has('Authorization')).toBe(false);
  });

  it('withholds the token from a public route even when one is present', async () => {
    // The API applies no auth to the theme routes, so sending the session there
    // would spend it for nothing.
    await request('/bff/ai/themes/external', {
      method: 'POST',
      cookie: 'bh_session=jwt-123',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Dune', authorName: 'Frank Herbert' }),
    });

    expect(apiCall(fetchMock).headers.has('Authorization')).toBe(false);
  });

  it('404s a real API route that no page needs', async () => {
    // /auth/forgot-password exists on the API and is deliberately absent from
    // the manifest. Narrowing the surface is the point of the list.
    const response = await request('/bff/auth/forgot-password', { method: 'POST' });

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('matches literal segments before the parameters that would swallow them', async () => {
    // DELETE /library/bulk must not arrive at the API as bookId "bulk".
    await request('/bff/library/bulk', {
      method: 'DELETE',
      cookie: 'bh_session=jwt-123',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookIds: [1, 2] }),
    });

    expect(apiCall(fetchMock).url).toBe(`${API}/library/bulk`);
  });

  it('passes the request body through unchanged', async () => {
    const body = JSON.stringify({ bookIds: [1, 2, 3] });
    await request('/bff/library/bulk', {
      method: 'POST',
      cookie: 'bh_session=jwt-123',
      headers: { 'content-type': 'application/json' },
      body,
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(Buffer.from(init.body as Uint8Array).toString('utf8')).toBe(body);
  });

  it('sends no body on a GET, so the API does not read an empty document', async () => {
    await request('/bff/library', { cookie: 'bh_session=jwt-123' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeUndefined();
  });

  it('relays the status and body the API returned', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Not found' }, 404));

    const response = await request('/bff/books/dune');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('relays a 204 without a body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await request('/bff/library/7', {
      method: 'DELETE',
      cookie: 'bh_session=jwt-123',
    });

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe('');
  });

  it('relays the rate-limit headers so a 429 still explains itself', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '42' },
      }),
    );

    const response = await request('/bff/ai/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: 'dune' }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
  });

  it('reports an unreachable API as a gateway failure, not the caller’s fault', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request('/bff/books/dune');

    expect(response.status).toBe(502);
    errorSpy.mockRestore();
  });

  it('forwards the caller address so the API rate-limits per reader', async () => {
    await request('/bff/books/dune');

    expect(apiCall(fetchMock).headers.get('X-Forwarded-For')).toBe('::ffff:127.0.0.1');
  });

  it('lists no route twice', () => {
    // A duplicate is dead weight at best: the first registration wins, so a
    // later entry tightening the auth on the same path would never take effect.
    const keys = FORWARD_ROUTES.map((route) => `${route.method} ${route.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('orders literal paths ahead of the parameters that would shadow them', () => {
    // The ordering rule the manifest depends on, checked rather than trusted:
    // a literal registered after a same-method parameter is unreachable.
    for (const [index, route] of FORWARD_ROUTES.entries()) {
      if (route.path.includes(':')) continue;
      const shadowIndex = FORWARD_ROUTES.findIndex(
        (other, otherIndex) =>
          otherIndex < index && other.method === route.method && shadows(other.path, route.path),
      );
      expect({ route: route.path, shadowedBy: FORWARD_ROUTES[shadowIndex]?.path }).toEqual({
        route: route.path,
        shadowedBy: undefined,
      });
    }
  });
});
