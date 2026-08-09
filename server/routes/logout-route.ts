import type { Request, Response } from 'express';
import { clearSessionCookie } from '../session/clear-session-cookie.js';

/**
 * POST /bff/auth/logout — drops the cookie.
 *
 * New with the BFF: signing out used to be a purely client-side act, because
 * the token lived somewhere the client could delete. Now only the server can.
 * The API is not called: it issues stateless JWTs and has nothing to revoke.
 */
export function logoutRoute(_req: Request, res: Response): void {
  clearSessionCookie(res);
  res.status(204).end();
}
