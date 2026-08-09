import type { NextFunction, Request, Response } from 'express';
import { readSessionToken } from './read-session-token.js';

/**
 * Rejects a request that carries no session cookie, before it costs a round
 * trip to the API.
 *
 * Presence is all this checks. The BFF holds no JWT_SECRET and deliberately
 * does not verify the token — the API stays the sole authority on whether a
 * session is real, so an expired or forged token still 401s, just one hop
 * later. The error body matches the API's own (`middleware/auth.ts`) so the
 * frontend cannot tell the two apart.
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!readSessionToken(req)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
