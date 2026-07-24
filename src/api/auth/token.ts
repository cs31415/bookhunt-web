// Single source of truth for how the auth token (and cached user) are stored.
// Both apiFetch (src/api/client.ts) and useAuth (src/features/auth) go through
// here, so when the BFF lands (LOS-119) and moves auth to an httpOnly cookie,
// only this module changes — nothing else touches localStorage directly.

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
}

const TOKEN_STORAGE_KEY = 'bookhunt_token';
const USER_STORAGE_KEY = 'bookhunt_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

// We cache the user object alongside the token so logged-in state survives a
// page reload without needing a "current user" endpoint. Swap for GET /auth/me
// if/when the BFF exposes one.
export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}
