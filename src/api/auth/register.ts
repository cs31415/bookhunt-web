import { apiFetch } from '../client';
import type { AuthUser } from './stored-user';

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  handle: string;
  /** Required unless the API runs with REGISTRATION_MODE=open (LOS-376). */
  inviteCode: string;
}

// Matches POST /auth/register (LOS-218, LOS-250): 201 → { user,
// verificationRequired }. Deliberately no token — the account cannot sign in
// until its address is confirmed, so registering does not create a session.
// 409 when the address is taken (case-insensitively), or 409 with code
// HANDLE_TAKEN when the handle is; 400 with a reader-facing message on a bad
// field. 403 with INVITE_REQUIRED or INVITE_INVALID when the code is missing or
// will not do (LOS-376) -- the two are one refusal on the server's side, since
// separating them would let someone test codes against this endpoint.
export interface RegisterResponse {
  user: AuthUser;
  verificationRequired: boolean;
}

export function postRegister(body: RegisterRequest): Promise<RegisterResponse> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
