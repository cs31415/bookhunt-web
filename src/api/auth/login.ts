import { apiFetch } from '../client';
import type { AuthUser } from './token';

export interface LoginRequest {
  email: string;
  password: string;
}

// Matches POST /auth/login (LOS-57): 200 → { user, token }, 401 on bad
// credentials (generic error, no user enumeration).
export interface LoginResponse {
  user: AuthUser;
  token: string;
}

export function postLogin(body: LoginRequest): Promise<LoginResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
