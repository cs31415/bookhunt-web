import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPhotoImportEnabled } from './features';

describe('isPhotoImportEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is enabled only for the exact string "true"', () => {
    vi.stubEnv('VITE_ENABLE_PHOTO_IMPORT', 'true');
    expect(isPhotoImportEnabled()).toBe(true);
  });

  // Default-off matters: photo import needs per-environment S3 CORS to work at
  // all, so an environment that hasn't opted in shouldn't advertise it.
  it.each(['false', '', 'TRUE', '1', 'yes', undefined])('is disabled for %o', (value) => {
    vi.stubEnv('VITE_ENABLE_PHOTO_IMPORT', value as string);
    expect(isPhotoImportEnabled()).toBe(false);
  });
});
