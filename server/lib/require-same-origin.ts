import type { NextFunction, Request, Response } from 'express';

/**
 * Requires that the request came from the app itself, in a browser.
 *
 * `Sec-Fetch-Site` is set by the browser and cannot be overridden by page
 * script, which makes it a sharper instrument than comparing `Origin` against
 * a configured value — there is no second copy of the origin to drift, and it
 * covers reads as well as writes:
 *
 * | caller                        | Sec-Fetch-Site |     |
 * |-------------------------------|----------------|-----|
 * | the SPA calling fetch         | same-origin    | ok  |
 * | a URL pasted in the addressbar| none           | 403 |
 * | another site, any method      | cross-site     | 403 |
 * | a bare non-browser client     | absent         | 403 |
 *
 * Rejecting the absent case is deliberate: the SPA is this server's only
 * intended caller, and `/bff/health` is registered ahead of this guard for
 * anything that needs a liveness probe. Reaching it from a terminal takes
 * `-H 'Sec-Fetch-Site: same-origin'`.
 *
 * This is **not** a security boundary, and must not be relied on as one — that
 * same one-line header defeats it. What it buys is that the browser cannot be
 * used as a deputy (the CSRF risk the cookie session reintroduced, which a
 * Bearer header never had) and that BFF URLs are not casually loadable. The
 * defences that hold against a determined caller are the session itself, rate
 * limiting, and not doing paid or persisting work on unauthenticated reads.
 */
export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (req.get('sec-fetch-site') !== 'same-origin') {
    // Bare 403. By definition the SPA never sees this response, so any body
    // would be read only by whoever is poking at the endpoint — and describing
    // how it is gated tells them something they have no need for.
    res.status(403).end();
    return;
  }
  next();
}
