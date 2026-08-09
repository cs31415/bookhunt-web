import type { NextFunction, Request, Response } from 'express';
import { getAppOrigin } from '../config/app-origin.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF guard for the cookie session.
 *
 * A Bearer header could never be sent by another site; a cookie can, so moving
 * the token into one reintroduces CSRF. `SameSite=Lax` already blocks the
 * classic cross-site form POST, and this closes the rest: browsers always
 * attach `Origin` to a cross-origin fetch, so a mismatch is unambiguous.
 *
 * A *missing* Origin is allowed through on purpose. Browsers send it on every
 * request this guard cares about, so absence means a non-browser client (curl,
 * a health probe) — which has no ambient cookie to abuse in the first place.
 */
export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin');
  if (origin !== undefined && origin !== getAppOrigin()) {
    res.status(403).json({ error: 'Cross-origin request rejected' });
    return;
  }

  next();
}
