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
    return await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', ...rest, headers });
  } finally {
    server.close();
  }
}

let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;

beforeEach(() => {
  process.env.API_BASE_URL = API;
  process.env.APP_ORIGIN = 'http://app.test';
  fetchMock = vi.fn();
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith(API)
      ? fetchMock(input, init)
      : realFetch(input, init)) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.API_BASE_URL;
  delete process.env.APP_ORIGIN;
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

describe('the CSRF guard', () => {
  it('rejects a mutation from another origin', async () => {
    const response = await post('/bff/library/dune', {
      cookie: 'bh_session=jwt-123',
      headers: { Origin: 'http://evil.test', 'content-type': 'application/json' },
      body: '{}',
    });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows a mutation from the app itself', async () => {
    fetchMock.mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const response = await post('/bff/library/dune', {
      cookie: 'bh_session=jwt-123',
      headers: { Origin: 'http://app.test', 'content-type': 'application/json' },
      body: '{}',
    });

    expect(response.status).toBe(200);
  });

  it('leaves reads alone whatever their origin', async () => {
    fetchMock.mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const server = createApp().listen(0);
    const { port } = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${port}/bff/books/dune`, {
      headers: { Origin: 'http://evil.test' },
    });
    server.close();

    // A cross-origin read cannot be read back by the attacker anyway, and the
    // SameSite cookie means it carries no session.
    expect(response.status).toBe(200);
  });
});
