/**
 * Name of the httpOnly cookie carrying the bookhunt JWT.
 *
 * Read lazily — see the note in ../config/api-base-url.ts.
 */
export function getSessionCookieName(): string {
  return process.env.SESSION_COOKIE_NAME ?? 'bh_session';
}
