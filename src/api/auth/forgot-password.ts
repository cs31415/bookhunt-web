import { apiFetch } from '../client';

export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Matches POST /auth/forgot-password. Always resolves to { ok: true } whether or
 * not the address has an account — the API is deliberately silent about which,
 * so a stranger cannot use this form to discover who has signed up.
 *
 * That silence is the caller's constraint too: the page must show the same
 * confirmation either way, and must not, for instance, offer to resend only
 * when the address was real.
 */
export function postForgotPassword(body: ForgotPasswordRequest): Promise<{ ok: boolean }> {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
