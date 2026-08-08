import { apiFetch } from '../client';
import type { AuthUser } from './token';

export interface VerifyEmailRequest {
  token: string;
}

// Matches POST /auth/verify-email (LOS-218). Returns a session token, so
// following the link from the sign-up email signs the reader straight in rather
// than handing them to the login form. 400 covers unknown, expired and
// already-used alike — the backend does not distinguish them.
export interface VerifyEmailResponse {
  user: AuthUser;
  token: string;
}

export function postVerifyEmail(body: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  return apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
