import { afterEach, describe, expect, it, vi } from 'vitest';
import { storeCredential } from './store-credential';

/**
 * jsdom has neither navigator.credentials nor PasswordCredential, which is the
 * same shape as Safari and Firefox — so the unsupported path is what runs by
 * default here, and the supported one has to be stood up deliberately.
 */
function withCredentialSupport(store: () => Promise<unknown>) {
  // Typed via the generic rather than a named parameter: the signature is what
  // lets the assertions below read mock.calls[0][0], since vi.fn over a
  // zero-arg function infers an empty tuple — but an actual unused parameter
  // would trip no-unused-vars.
  const credentials = { store: vi.fn<(credential: unknown) => Promise<unknown>>(() => store()) };
  Object.defineProperty(navigator, 'credentials', { value: credentials, configurable: true });
  (window as unknown as { PasswordCredential: unknown }).PasswordCredential = class {
    id: string;
    password: string;
    constructor(data: { id: string; password: string }) {
      this.id = data.id;
      this.password = data.password;
    }
  };
  return credentials;
}

afterEach(() => {
  delete (window as unknown as { PasswordCredential?: unknown }).PasswordCredential;
  Reflect.deleteProperty(navigator, 'credentials');
  vi.restoreAllMocks();
});

describe('storeCredential', () => {
  it('offers the credential to the browser when supported', async () => {
    const credentials = withCredentialSupport(() => Promise.resolve(undefined));

    await storeCredential('reader@example.com', 'correct-horse-battery');

    expect(credentials.store).toHaveBeenCalledTimes(1);
    const stored = credentials.store.mock.calls[0][0] as { id: string; password: string };
    expect(stored.id).toBe('reader@example.com');
    expect(stored.password).toBe('correct-horse-battery');
  });

  /**
   * The whole point is that this runs after the account or session already
   * exists. A browser that refuses — unsupported, insecure context, or the
   * reader dismissing the prompt — must never turn a successful sign-in into a
   * visible failure.
   */
  it('never rejects when the browser refuses', async () => {
    withCredentialSupport(() => Promise.reject(new Error('user declined')));

    await expect(storeCredential('reader@example.com', 'pw')).resolves.toBeUndefined();
  });

  it('does nothing where the API is absent, as in Safari and Firefox', async () => {
    await expect(storeCredential('reader@example.com', 'pw')).resolves.toBeUndefined();
  });

  it('does not construct a credential without both an address and a password', async () => {
    const credentials = withCredentialSupport(() => Promise.resolve(undefined));

    await storeCredential(null, 'pw');
    await storeCredential('reader@example.com', '');

    expect(credentials.store).not.toHaveBeenCalled();
  });
});
