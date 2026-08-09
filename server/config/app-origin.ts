/**
 * The single origin the browser app is served from. Used by the CSRF guard to
 * recognise its own requests. In dev this is the Vite dev server, which proxies
 * /bff here, so the browser only ever sees one origin.
 *
 * Read lazily — see the note in api-base-url.ts.
 */
export function getAppOrigin(): string {
  return process.env.APP_ORIGIN ?? 'http://localhost:5173';
}
