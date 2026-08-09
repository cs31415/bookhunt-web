import { apiFetch } from '../client';
import type { AuthUser } from './stored-user';

export interface VerifyEmailRequest {
  token: string;
}

// Matches POST /bff/auth/verify-email (LOS-218). Begins a session, so following
// the link from the sign-up email signs the reader straight in rather than
// handing them to the login form. 400 covers unknown, expired and already-used
// alike — the backend does not distinguish them.
//
// As with login, the session arrives as a cookie rather than in the body.
export interface VerifyEmailResponse {
  user: AuthUser;
}

export function postVerifyEmail(body: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  return apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
