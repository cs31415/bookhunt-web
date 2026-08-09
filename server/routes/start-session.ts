import type { Request, Response as ExpressResponse } from 'express';
import { callApi } from '../lib/call-api.js';
import { relayResponse } from '../lib/relay-response.js';
import { setSessionCookie } from '../session/set-session-cookie.js';

interface SessionGrant {
  token?: unknown;
  [key: string]: unknown;
}

/**
 * Shared body of the two endpoints that begin a session: signing in, and
 * following the verification link from the sign-up email. Both answer
 * `{ user, token }` on success and are otherwise ordinary forwards.
 *
 * The token is moved into an httpOnly cookie and **stripped from the response**
 * — that swap is the entire point of the BFF, and doing it in one place means
 * neither endpoint can forget it. Everything else in the payload is passed
 * through untouched, so the API stays free to add fields.
 */
export async function startSession(
  req: Request,
  res: ExpressResponse,
  apiPath: string,
): Promise<void> {
  let apiResponse: Response;
  try {
    apiResponse = await callApi({
      method: 'POST',
      path: apiPath,
      clientIp: req.ip,
      contentType: req.get('content-type'),
      body: Buffer.isBuffer(req.body) ? req.body : undefined,
    });
  } catch (error) {
    console.error(`[bff] POST ${apiPath} could not reach the API:`, error);
    res.status(502).json({ error: 'The BookHunt API is unreachable' });
    return;
  }

  // A rejected sign-in carries a reader-facing message, and under LOS-218 a 403
  // the login form tells apart from bad credentials. Relay it verbatim.
  if (!apiResponse.ok) {
    await relayResponse(apiResponse, res);
    return;
  }

  const { token, ...rest } = (await apiResponse.json()) as SessionGrant;
  if (typeof token !== 'string') {
    console.error(`[bff] POST ${apiPath} succeeded without a token`);
    res.status(502).json({ error: 'The BookHunt API returned no session token' });
    return;
  }

  setSessionCookie(res, token);
  res.status(apiResponse.status).json(rest);
}
