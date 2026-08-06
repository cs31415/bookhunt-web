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
