import { apiFetch } from '../client';

export interface FavoriteUser {
  handle: string;
  displayName: string;
  /** Both directions exist, so the two can message each other. */
  isMutual: boolean;
}

/**
 * Owner-only; there is no public equivalent. Favourite books and authors are
 * taste and get published, but who a reader follows stays private.
 */
export function getFavoriteUsers(signal?: AbortSignal): Promise<{ users: FavoriteUser[] }> {
  return apiFetch('/users/favorites', { signal });
}
