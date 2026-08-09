import { describe, expect, it } from 'vitest';
import { readTokenExpiryMs } from './read-token-expiry.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function tokenWithPayload(payload: unknown): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

describe('readTokenExpiryMs', () => {
  it('measures the time left on the token’s exp claim', () => {
    const token = tokenWithPayload({ id: 7, exp: NOW / 1000 + 3600 });
    expect(readTokenExpiryMs(token, NOW)).toBe(3600 * 1000);
  });

  it('falls back to a week when the token carries no expiry', () => {
    expect(readTokenExpiryMs(tokenWithPayload({ id: 7 }), NOW)).toBe(WEEK_MS);
  });

  it('falls back when the token is already expired', () => {
    // Nothing useful to do with a negative lifetime: the API will reject the
    // token on the next call, which is the honest place to discover it.
    const token = tokenWithPayload({ id: 7, exp: NOW / 1000 - 60 });
    expect(readTokenExpiryMs(token, NOW)).toBe(WEEK_MS);
  });

  it('falls back on anything that is not a JWT', () => {
    expect(readTokenExpiryMs('not-a-token', NOW)).toBe(WEEK_MS);
    expect(readTokenExpiryMs('a.!!!not-base64!!!.c', NOW)).toBe(WEEK_MS);
  });
});
