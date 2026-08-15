import { apiFetch } from '../client';
import type { AuthUser } from './stored-user';

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  handle: string;
}

// Matches POST /auth/register (LOS-218, LOS-250): 201 → { user,
// verificationRequired }. Deliberately no token — the account cannot sign in
// until its address is confirmed, so registering does not create a session.
// 409 when the address is taken (case-insensitively), or 409 with code
// HANDLE_TAKEN when the handle is; 400 with a reader-facing message on a bad
// field.
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
