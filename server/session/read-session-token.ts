import type { Request } from 'express';
import { getSessionCookieName } from './session-cookie-name.js';

/** The caller's bookhunt JWT, if they have a session. Requires cookie-parser. */
export function readSessionToken(req: Request): string | undefined {
  const token: unknown = req.cookies?.[getSessionCookieName()];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}
