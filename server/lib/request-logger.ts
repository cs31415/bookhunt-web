import type { NextFunction, Request, Response } from 'express';

const REDACTED = '[REDACTED]';
const SENSITIVE_FIELDS = new Set(['password', 'newPassword', 'currentPassword', 'token']);

/**
 * One line per request, mirroring the API's own `middleware/requestLogger.ts`
 * so the two halves of a call read the same way side by side.
 *
 * Without this the middle hop was the only silent one — the API logs, the
 * browser logs behind VITE_LOG_API_CALLS, and the `[bff]` pane of `npm run dev`
 * showed nothing after startup. The requests that most needed a record were the
 * ones the BFF answers alone: a 401 from requireSession and a 403 from
 * requireSameOrigin never reach the API, so nothing anywhere recorded them.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    if (req.method === 'OPTIONS' || req.path === '/health') return;

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    let line = `[bff] ${req.method} ${redactedUrl(req.originalUrl)} ${res.statusCode} ${durationMs.toFixed(1)}ms`;

    const body = redactedBody(req);
    if (req.method === 'POST' && body) line += ` body=${body}`;

    console.log(line);
  });

  next();
}

/**
 * An unlisted share token is a bearer credential, and this line is written to
 * a log that outlives the request (LOS-305). SENSITIVE_FIELDS covers bodies;
 * this one is in the path, so it is stripped before the URL is printed.
 *
 * The route stays legible -- what was called still reads, only the secret does
 * not. Anything after the token, such as /library, is kept.
 */
function redactedUrl(url: string): string {
  return url.replace(
    /(\/users\/by-token\/)[^/?]+/,
    (_match, prefix: string) => `${prefix}${REDACTED}`,
  );
}

/**
 * The body as a redacted JSON string, or null when there is nothing useful to
 * show.
 *
 * Unlike the API's version this starts from raw bytes, because the BFF forwards
 * bodies verbatim rather than parsing them. Anything that does not decode as a
 * JSON object is skipped rather than printed: a log line is not worth risking
 * an unreadable blob, and it is certainly not worth an exception inside a
 * finish handler.
 */
function redactedBody(req: Request): string | null {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(req.body.toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const redacted = Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      SENSITIVE_FIELDS.has(key) ? REDACTED : value,
    ]),
  );
  return Object.keys(redacted).length > 0 ? JSON.stringify(redacted) : null;
}
