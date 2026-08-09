import { apiFetch } from '../client';

/**
 * POST /bff/auth/logout — drops the session cookie.
 *
 * Signing out is a server call now. It used to be a local delete, because the
 * token lived somewhere this code could reach; the httpOnly cookie that
 * replaced it (LOS-119) can only be cleared by the BFF that set it.
 */
export function postLogout(): Promise<void> {
  return apiFetch('/auth/logout', { method: 'POST' });
}
