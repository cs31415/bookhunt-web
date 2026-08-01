import { afterEach, describe, expect, it, vi } from 'vitest';
import { rowsPerRequest } from './resolve';

describe('rowsPerRequest', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to 20 when unset', () => {
    expect(rowsPerRequest()).toBe(20);
  });

  it('uses a configured value', () => {
    vi.stubEnv('VITE_IMPORT_ROWS_PER_REQUEST', '5');
    expect(rowsPerRequest()).toBe(5);
  });

  // The API rejects a batch over 40 outright, so a typo in an env file must not
  // turn every request of an import into a 400.
  it('clamps to the cap the API enforces', () => {
    vi.stubEnv('VITE_IMPORT_ROWS_PER_REQUEST', '500');
    expect(rowsPerRequest()).toBe(40);
  });

  it('floors a fractional value, since a batch is whole rows', () => {
    vi.stubEnv('VITE_IMPORT_ROWS_PER_REQUEST', '12.7');
    expect(rowsPerRequest()).toBe(12);
  });

  // A zero or a stray word would otherwise mean an import that loops forever or
  // sends nothing at all.
  it.each(['0', '-3', 'twenty', '', undefined])('falls back to the default for %o', (value) => {
    vi.stubEnv('VITE_IMPORT_ROWS_PER_REQUEST', value as string);
    expect(rowsPerRequest()).toBe(20);
  });
});
