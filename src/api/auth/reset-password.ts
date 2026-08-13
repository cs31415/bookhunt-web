import { apiFetch } from '../client';

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/**
 * Matches POST /auth/reset-password. Unlike forgot-password this does report
 * failure: a 400 means the token is invalid, already spent or expired, and the
 * reader needs to know that rather than be told their new password was set.
 *
 * Success does not sign the reader in — the API returns { ok } and no token —
 * so the page sends them to /login afterwards.
 */
export function postResetPassword(body: ResetPasswordRequest): Promise<{ ok: boolean }> {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
