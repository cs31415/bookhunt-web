import type { Request, Response } from 'express';
import { startSession } from './start-session.js';

/**
 * POST /bff/auth/verify-email — confirming the address signs the reader
 * straight in rather than handing them to the login form (LOS-218), so this
 * begins a session exactly as login does.
 *
 * Registering deliberately does not: under the same gate it returns no token,
 * which is why it is an ordinary manifest entry.
 */
export function verifyEmailRoute(req: Request, res: Response): Promise<void> {
  return startSession(req, res, '/auth/verify-email');
}
