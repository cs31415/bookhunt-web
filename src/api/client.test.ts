import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ hello: 'world' }),
      }),
    );

    const { apiFetch } = await import('./client');
    await expect(apiFetch('/ping')).resolves.toEqual({ hello: 'world' });
  });

  it('calls the BFF with the cookie attached and no Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('./client');
    await apiFetch('/library');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/bff/library');
    expect(init.credentials).toBe('include');
    expect((init.headers as Headers).has('Authorization')).toBe(false);
  });

  it('forgets the cached user and announces the expiry on a 401', async () => {
    localStorage.setItem('bookhunt_user', JSON.stringify({ id: 1, email: 'a@b.c', displayName: 'A' }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Authentication required' }),
      }),
    );
    const { SESSION_EXPIRED_EVENT } = await import('./auth/session-expired');
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    const { apiFetch } = await import('./client');
    await expect(apiFetch('/library')).rejects.toThrow('Authentication required');

    expect(localStorage.getItem('bookhunt_user')).toBeNull();
    expect(onExpired).toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  it('leaves the cached user alone when a sign-in attempt is rejected', async () => {
    // A 401 from /auth/login means the password was wrong, not that an existing
    // session lapsed — signing out whoever is already signed in would be wrong.
    localStorage.setItem('bookhunt_user', JSON.stringify({ id: 1, email: 'a@b.c', displayName: 'A' }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid email or password' }),
      }),
    );

    const { apiFetch } = await import('./client');
    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toThrow();

    expect(localStorage.getItem('bookhunt_user')).not.toBeNull();
  });

  it('throws an ApiError with the response error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'nope' }),
      }),
    );

    const { apiFetch, ApiError } = await import('./client');
    await expect(apiFetch('/missing')).rejects.toThrow(ApiError);
  });

  it('does not log request/response when VITE_LOG_API_CALLS is not "true"', async () => {
    vi.stubEnv('VITE_LOG_API_CALLS', 'false');
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      }),
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { apiFetch } = await import('./client');
    await apiFetch('/ping');

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs the request and response when VITE_LOG_API_CALLS=true', async () => {
    vi.stubEnv('VITE_LOG_API_CALLS', 'true');
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }),
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { apiFetch } = await import('./client');
    await apiFetch('/ping');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('→ GET /ping'), '');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('← GET /ping 200'), { ok: true });
  });

  it('logs failed responses when VITE_LOG_API_CALLS=true', async () => {
    vi.stubEnv('VITE_LOG_API_CALLS', 'true');
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'boom' }),
      }),
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { apiFetch } = await import('./client');
    await expect(apiFetch('/broken')).rejects.toThrow('boom');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('← GET /broken 500'), { error: 'boom' });
  });
});
