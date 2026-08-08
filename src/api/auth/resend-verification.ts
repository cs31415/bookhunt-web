import { apiFetch } from '../client';

export interface ResendVerificationRequest {
  email: string;
}

// Matches POST /auth/resend-verification (LOS-218). Always resolves to
// { ok: true }, whether or not the address has an account and whether or not it
// is already verified, so there is nothing here to report back to the reader
// beyond "we have sent it if there was anything to send".
export function postResendVerification(
  body: ResendVerificationRequest,
): Promise<{ ok: boolean }> {
  return apiFetch('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
