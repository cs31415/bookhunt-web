import type { Response as ExpressResponse } from 'express';

/**
 * Headers worth carrying back from the API. Everything else (Date, Connection,
 * the encoding headers undici has already applied) describes the hop the
 * browser never sees, and copying those breaks the response.
 *
 * The rate-limit family is here because the API's limiter is the one the reader
 * is actually subject to — swallowing its headers would leave a 429 with no
 * explanation of when to try again.
 */
const RELAYED_HEADERS = [
  'content-type',
  'retry-after',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'ratelimit-policy',
];

/** Copies an API response back to the browser, status and body unchanged. */
export async function relayResponse(apiResponse: Response, res: ExpressResponse): Promise<void> {
  res.status(apiResponse.status);
  for (const name of RELAYED_HEADERS) {
    const value = apiResponse.headers.get(name);
    if (value !== null) res.set(name, value);
  }

  if (apiResponse.status === 204) {
    res.end();
    return;
  }

  res.send(Buffer.from(await apiResponse.arrayBuffer()));
}
