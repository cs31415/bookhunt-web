import { apiFetch } from '../client';
import type { AuthUser } from './stored-user';

export interface LoginRequest {
  email: string;
  password: string;
}

// Matches POST /bff/auth/login: 200 → { user }, 401 on bad credentials
// (generic error, no user enumeration), 403 when the address is unverified.
//
// No token. The API still issues one (LOS-57), but the BFF keeps it, putting it
// in an httpOnly cookie the browser attaches from here on (LOS-119).
export interface LoginResponse {
  user: AuthUser;
}

export function postLogin(body: LoginRequest): Promise<LoginResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
