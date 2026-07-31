/**
 * Feature flags, read from Vite's env at call time rather than captured at
 * module load. Two reasons: tests can stub a flag with vi.stubEnv without
 * resetting modules, and nothing silently depends on import order.
 *
 * Vite still substitutes `import.meta.env` at build time, so changing a flag
 * needs a dev-server restart rather than just a reload.
 */

/**
 * Photo import (LOS-82) is opt-in. It only functions where the S3 upload bucket
 * has a CORS rule allowing browser POSTs (LOS-164), and spine-recognition
 * accuracy is still unproven, so a checkout without the flag shouldn't advertise
 * it. Anything other than the exact string 'true' leaves it disabled.
 */
export function isPhotoImportEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_PHOTO_IMPORT === 'true';
}
