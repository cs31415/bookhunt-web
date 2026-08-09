import type { Request, Response } from 'express';
import { startSession } from './start-session.js';

/** POST /bff/auth/login — signs in and answers `{ user }`, session in a cookie. */
export function loginRoute(req: Request, res: Response): Promise<void> {
  return startSession(req, res, '/auth/login');
}
