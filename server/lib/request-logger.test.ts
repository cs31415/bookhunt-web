import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../create-app.js';

const API = 'http://api.test/api';

let logSpy: ReturnType<typeof vi.spyOn>;
const realFetch = globalThis.fetch;

/** Every line the BFF logged, joined so a test can assert on one string. */
function logged(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const server = createApp().listen(0);
  try {
    const { port } = server.address() as { port: number };
    const headers = new Headers(init.headers);
    if (!headers.has('Sec-Fetch-Site')) headers.set('Sec-Fetch-Site', 'same-origin');
    return await fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers });
  } finally {
    server.close();
  }
}

beforeEach(() => {
  process.env.API_BASE_URL = API;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith(API)
      ? Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
      : realFetch(input, init)) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  logSpy.mockRestore();
  delete process.env.API_BASE_URL;
});

describe('the BFF request logger', () => {
  it('records the method, path, status and duration', async () => {
    await request('/bff/books/dune');

    expect(logged()).toMatch(/^\[bff] GET \/bff\/books\/dune 200 [\d.]+ms$/m);
  });

  it('records what the guards reject, which nothing else would', async () => {
    // A 403 here never reaches the API, so without this line the request
    // leaves no trace anywhere.
    await request('/bff/books/dune', { headers: { 'Sec-Fetch-Site': 'none' } });
    await request('/bff/library');

    expect(logged()).toContain('[bff] GET /bff/books/dune 403');
    expect(logged()).toContain('[bff] GET /bff/library 401');
  });

  it('logs a POST body but never a password or a token', async () => {
    await request('/bff/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'reader@example.com', password: 'b00kW0rm!' }),
    });

    expect(logged()).toContain('"email":"reader@example.com"');
    expect(logged()).toContain('"password":"[REDACTED]"');
    expect(logged()).not.toContain('b00kW0rm!');
  });

  it('skips a body that is not JSON rather than printing a blob', async () => {
    await request('/bff/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'not json at all',
    });

    expect(logged()).toContain('[bff] POST /bff/auth/login');
    expect(logged()).not.toContain('not json at all');
  });

  it('stays quiet for the health check', async () => {
    // Mirrors the API skipping /api/health: a liveness probe every few seconds
    // would bury everything else.
    await request('/bff/health');

    expect(logged()).toBe('');
  });
});
