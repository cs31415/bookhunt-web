import type { Response } from 'express';
import { getSessionCookieName } from './session-cookie-name.js';
import { readTokenExpiryMs } from './read-token-expiry.js';

/**
 * Hands the browser its session.
 *
 * `httpOnly` is the whole point of the BFF: the token stops being readable by
 * any script on the page. `sameSite: 'lax'` is the first line of CSRF defence —
 * the cookie simply is not attached to cross-site POSTs (requireSameOrigin is
 * the second). `secure` is off outside production only because dev runs over
 * plain http on localhost.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: readTokenExpiryMs(token),
  });
}
