import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../create-app.js';

const API = 'http://api.test/api';
const USER = { id: 7, email: 'reader@example.com', displayName: 'Ada Reader' };

/** A JWT-shaped token whose payload expires an hour from now. */
function tokenExpiringIn(seconds: number): string {
  const payload = Buffer.from(JSON.stringify({ id: 7, exp: Math.floor(Date.now() / 1000) + seconds }))
    .toString('base64url');
  return `header.${payload}.signature`;
}

async function post(path: string, init: RequestInit & { cookie?: string } = {}): Promise<Response> {
  const { cookie, ...rest } = init;
  const server = createApp().listen(0);
  try {
    const { port } = server.address() as { port: number };
    const headers = new Headers(rest.headers);
    if (cookie) headers.set('Cookie', cookie);
    if (!headers.has('Sec-Fetch-Site')) headers.set('Sec-Fetch-Site', 'same-origin');
    return await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', ...rest, headers });
  } finally {
    server.close();
  }
}

let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;

beforeEach(() => {
  process.env.API_BASE_URL = API;
  fetchMock = vi.fn();
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith(API)
      ? fetchMock(input, init)
      : realFetch(input, init)) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.API_BASE_URL;
  delete process.env.NODE_ENV;
});

describe('POST /bff/auth/login', () => {
  it('moves the token into an httpOnly cookie and keeps it out of the body', async () => {
    const token = tokenExpiringIn(3600);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: USER, token }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await post('/bff/auth/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: USER.email, password: 'b00kW0rm!' }),
    });

    // The whole point: the browser is told about the reader, never the token.
    await expect(response.json()).resolves.toEqual({ user: USER });

    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`bh_session=${token}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('sizes the cookie from the token’s own expiry', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: USER, token: tokenExpiringIn(3600) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await post('/bff/auth/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: USER.email, password: 'b00kW0rm!' }),
    });

    // Reading the claim rather than configuring a second lifetime is what stops
    // the cookie and the token from drifting apart.
    const maxAge = Number(/Max-Age=(\d+)/.exec(response.headers.get('set-cookie') ?? '')?.[1]);
    expect(maxAge).toBeGreaterThan(3500);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });

  it('omits Secure outside production, so dev over plain http still works', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: USER, token: tokenExpiringIn(60) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await post('/bff/auth/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: USER.email, password: 'b00kW0rm!' }),
    });

    expect(response.headers.get('set-cookie')).not.toContain('Secure');
  });

  it('relays a rejected sign-in verbatim and sets no cookie', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await post('/bff/auth/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: USER.email, password: 'wrong' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid email or password' });
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

describe('POST /bff/auth/logout', () => {
  it('clears the cookie without troubling the API', async () => {
    const response = await post('/bff/auth/logout', { cookie: 'bh_session=jwt-123' });

    expect(response.status).toBe(204);
    // Expiring it in the past is how a cookie is removed.
    expect(response.headers.get('set-cookie')).toContain('bh_session=;');
    // Stateless JWTs: the API has nothing to revoke.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the same-origin guard', () => {
  /** A raw request, so the helper does not supply Sec-Fetch-Site for us. */
  async function raw(path: string, headers: Record<string, string> = {}): Promise<Response> {
    const server = createApp().listen(0);
    try {
      const { port } = server.address() as { port: number };
      return await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    } finally {
      server.close();
    }
  }

  beforeEach(() => {
    fetchMock.mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  });

  it('allows what the SPA sends', async () => {
    const response = await raw('/bff/books/dune', { 'Sec-Fetch-Site': 'same-origin' });
    expect(response.status).toBe(200);
  });

  it('rejects a URL pasted into the address bar', async () => {
    // Sec-Fetch-Site: none is a top-level navigation. This is the case that
    // made /bff/books/... loadable in an incognito window (LOS-223).
    const response = await raw('/bff/books/dune', { 'Sec-Fetch-Site': 'none' });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a request from another site', async () => {
    const response = await raw('/bff/books/dune', { 'Sec-Fetch-Site': 'cross-site' });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a client that sends no Sec-Fetch-Site at all', async () => {
    // Browsers always send it, so its absence means a non-browser caller, and
    // the SPA is the only caller this server is for.
    const response = await raw('/bff/books/dune');

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('guards reads as well as writes', async () => {
    // The Origin check this replaced only ran on mutating methods, which is
    // exactly how a GET navigation slipped past it.
    const server = createApp().listen(0);
    const { port } = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${port}/bff/library/dune`, {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'none', Cookie: 'bh_session=jwt-123' },
    });
    server.close();

    expect(response.status).toBe(403);
  });

  it('leaves the health check reachable', async () => {
    // Registered ahead of the guard: a liveness probe is not a browser and has
    // no session to abuse.
    const response = await raw('/bff/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
