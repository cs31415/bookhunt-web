// Single source of truth for what the browser remembers about the signed-in
// reader.
//
// The session token is not here, and cannot be: since the BFF landed (LOS-119)
// it lives in an httpOnly cookie the browser attaches on its own and no script
// can read. What remains is the user object, which is display data rather than
// a credential — keeping it in localStorage is what lets AuthProvider hydrate
// synchronously on reload instead of every page waiting on a "who am I" call.
//
// The two can disagree: the cookie can expire while the cached user lingers.
// apiFetch settles it by clearing this on a 401.

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
}

const USER_STORAGE_KEY = 'bookhunt_user';

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
}
