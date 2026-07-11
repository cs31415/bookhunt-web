import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('apiFetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    }) as unknown as typeof fetch;

    const { apiFetch } = await import('./client');
    await expect(apiFetch('/ping')).resolves.toEqual({ hello: 'world' });
  });

  it('throws an ApiError with the response error message on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'nope' }),
    }) as unknown as typeof fetch;

    const { apiFetch, ApiError } = await import('./client');
    await expect(apiFetch('/missing')).rejects.toThrow(ApiError);
  });

  it('does not log request/response when VITE_LOG_API_CALLS is not "true"', async () => {
    vi.stubEnv('VITE_LOG_API_CALLS', 'false');
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { apiFetch } = await import('./client');
    await apiFetch('/ping');

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs the request and response when VITE_LOG_API_CALLS=true', async () => {
    vi.stubEnv('VITE_LOG_API_CALLS', 'true');
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { apiFetch } = await import('./client');
    await apiFetch('/ping');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('→ GET /ping'), '');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('← GET /ping 200'), { ok: true });
  });

  it('logs failed responses when VITE_LOG_API_CALLS=true', async () => {
    vi.stubEnv('VITE_LOG_API_CALLS', 'true');
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'boom' }),
    }) as unknown as typeof fetch;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { apiFetch } = await import('./client');
    await expect(apiFetch('/broken')).rejects.toThrow('boom');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('← GET /broken 500'), { error: 'boom' });
  });
});
