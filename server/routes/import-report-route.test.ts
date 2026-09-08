import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../create-app.js';

/**
 * The import report is answered here rather than forwarded: only the browser
 * sees a whole import, and the log it belongs in is the BFF's (LOS-394).
 */

const COOKIE = 'bh_session=a.b.c';

async function post(body: unknown, init: { cookie?: string } = {}): Promise<Response> {
  const server = createApp().listen(0);
  try {
    const { port } = server.address() as { port: number };
    const headers = new Headers({
      'content-type': 'application/json',
      'Sec-Fetch-Site': 'same-origin',
    });
    if (init.cookie !== undefined) headers.set('Cookie', init.cookie);
    return await fetch(`http://127.0.0.1:${port}/bff/import/report`, {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  } finally {
    server.close();
  }
}

const entry = {
  title: 'Early India',
  author: 'Romila Thapar',
  publisher: 'Penguin',
  isbn: null,
  failures: [{ provider: 'google_books', status: 429, detail: 'Rate Limit Exceeded' }],
};

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Quiet the per-request line; this suite is about what the route prints.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const printed = () => warn.mock.calls.map((call) => String(call[0])).join('\n');

describe('POST /bff/import/report', () => {
  it('prints the session report to the BFF log', async () => {
    const response = await post({ rows: 40, batches: 2, entries: [entry] }, { cookie: COOKIE });

    expect(response.status).toBe(204);
    expect(printed()).toContain('[csv-import] 40 rows, 2 batches: 1 did not resolve');
    expect(printed()).toContain('google_books: HTTP 429 Rate Limit Exceeded');
    expect(printed()).toContain('Early India by Romila Thapar (Penguin)');
  });

  // A clean import posts nothing, but an empty list must not print a heading.
  it('prints nothing when no row failed', async () => {
    const response = await post({ rows: 40, batches: 2, entries: [] }, { cookie: COOKIE });

    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it('needs a session, like every other route that is not the login', async () => {
    const response = await post({ rows: 1, batches: 1, entries: [entry] });

    expect(response.status).toBe(401);
    expect(warn).not.toHaveBeenCalled();
  });

  /*
   * The body is written by a browser, so the route trusts none of it. A
   * malformed report is dropped rather than answered with an error: there is
   * nothing the reader could do about it, and the import itself is fine.
   */
  it('drops a body that is not a report, without failing the caller', async () => {
    const response = await post('not json at all', { cookie: COOKIE });

    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it('drops entries that are not rows, and keeps the ones that are', async () => {
    const response = await post(
      { rows: 2, batches: 1, entries: [entry, null, { author: 'No title here' }, 42] },
      { cookie: COOKIE },
    );

    expect(response.status).toBe(204);
    expect(printed()).toContain('1 did not resolve');
    expect(printed()).not.toContain('No title here');
  });

  it('reads a row no provider had a match for as a miss, not an error', async () => {
    await post(
      { rows: 1, batches: 1, entries: [{ ...entry, title: 'Zen Garden', failures: [] }] },
      { cookie: COOKIE },
    );

    expect(printed()).toContain('1 because no provider had a match:');
  });
});
