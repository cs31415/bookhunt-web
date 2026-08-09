/** A week, matching the API's own JWT_EXPIRES_IN default. */
const FALLBACK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How long the session cookie should live, taken from the JWT's own `exp`
 * claim.
 *
 * Reading the claim rather than configuring a second lifetime here is what
 * keeps the cookie and the token from drifting apart: a cookie that outlives
 * its token leaves the app looking signed in until the next 401, and one that
 * expires early signs the reader out while their token is still perfectly good.
 *
 * The payload is decoded, never verified — the BFF has no JWT_SECRET, and does
 * not need one. The API remains the only judge of whether a token is real; a
 * forged `exp` would at worst mis-size a cookie holding a token the API will
 * reject anyway.
 */
export function readTokenExpiryMs(token: string, now: number = Date.now()): number {
  const payload = decodePayload(token);
  if (typeof payload?.exp !== 'number') return FALLBACK_LIFETIME_MS;

  const remaining = payload.exp * 1000 - now;
  return remaining > 0 ? remaining : FALLBACK_LIFETIME_MS;
}

function decodePayload(token: string): { exp?: unknown } | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as { exp?: unknown };
  } catch {
    return null;
  }
}
