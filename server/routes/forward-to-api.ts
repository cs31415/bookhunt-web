import type { Request, RequestHandler, Response } from 'express';
import { callApi } from '../lib/call-api.js';
import { relayResponse } from '../lib/relay-response.js';
import { readSessionToken } from '../session/read-session-token.js';
import type { ForwardAuth } from './forward-manifest.js';

/**
 * Builds the handler behind every manifest entry.
 *
 * There is one of these rather than thirty hand-written proxies because the BFF
 * paths and the API paths are identical below the mount point — the value of
 * the manifest is in *which* routes get registered, not in how each one is
 * forwarded.
 */
export function forwardToApi(auth: ForwardAuth): RequestHandler {
  return async (req, res) => {
    try {
      const apiResponse = await callApi({
        method: req.method,
        path: apiPathFor(req),
        token: auth === 'public' ? undefined : readSessionToken(req),
        clientIp: req.ip,
        contentType: req.get('content-type'),
        body: requestBody(req),
      });
      await relayResponse(apiResponse, res);
    } catch (error) {
      reportUnreachable(req, res, error);
    }
  };
}

/**
 * The path to call on the API: everything after the /bff mount, query string
 * included. `req.url` alone would be missing the segments Express matched.
 */
function apiPathFor(req: Request): string {
  return req.originalUrl.slice(req.baseUrl.length);
}

/**
 * The raw body as express.raw() left it. Kept as bytes rather than parsed and
 * re-serialised so what the API receives is byte-for-byte what the browser
 * sent.
 */
function requestBody(req: Request): Buffer | undefined {
  return Buffer.isBuffer(req.body) ? req.body : undefined;
}

/**
 * fetch only rejects when no response arrived at all — the API being down,
 * refusing the connection, or unresolvable. That is a gateway failure, not the
 * caller's fault, so it must not be reported as one.
 */
function reportUnreachable(req: Request, res: Response, error: unknown): void {
  console.error(`[bff] ${req.method} ${apiPathFor(req)} could not reach the API:`, error);
  res.status(502).json({ error: 'The BookHunt API is unreachable' });
}
