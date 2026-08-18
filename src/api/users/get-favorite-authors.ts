import { apiFetch } from '../client';

export interface FavoriteAuthor {
  name: string;
  slug: string;
  /** How many of that author's books the reader owns. */
  bookCount: number;
  /**
   * Kept off the public page (LOS-282). Present on the owner's own list only:
   * a visitor is never told something was withheld, only shown what was not.
   */
  isHidden?: boolean;
}

/** The signed-in reader's own list. */
export function getMyFavoriteAuthors(signal?: AbortSignal): Promise<{ authors: FavoriteAuthor[] }> {
  return apiFetch('/authors/favorites', { signal });
}

/** A reader's list as a visitor sees it; empty for an unknown or private handle. */
export function getPublicFavoriteAuthors(
  handle: string,
  signal?: AbortSignal,
): Promise<{ authors: FavoriteAuthor[] }> {
  return apiFetch(`/users/${encodeURIComponent(handle)}/favorite-authors`, { signal });
}
