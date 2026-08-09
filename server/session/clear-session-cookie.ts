import type { Response } from 'express';
import { getSessionCookieName } from './session-cookie-name.js';

/**
 * Ends the session. The attributes have to match the ones setSessionCookie used
 * or the browser treats it as a different cookie and leaves the original in
 * place.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(getSessionCookieName(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
