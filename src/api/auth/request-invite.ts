import { apiFetch } from '../client';

export interface RequestInviteRequest {
  email: string;
  note?: string;
  /**
   * Honeypot. Hidden from people and left empty by them; a bot filling in every
   * field trips it. Sent as an ordinary field so it looks like one.
   */
  website?: string;
}

/**
 * Matches POST /auth/request-invite (LOS-381). Resolves to { received: true }
 * for any well-formed address, whether or not it already has an account,
 * whether the write succeeded, and whether the API's database is up.
 *
 * That silence is the caller's constraint too: the page must show one
 * confirmation and must not, for instance, say anything different for an
 * address that turns out to be registered. A closed door should not double as
 * a directory of who is behind it.
 */
export function postRequestInvite(body: RequestInviteRequest): Promise<{ received: boolean }> {
  return apiFetch('/auth/request-invite', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
