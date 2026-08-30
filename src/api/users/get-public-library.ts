import { apiFetch } from '../client';
import type { RawLibraryEntry } from '../../normalize/library';

export interface PublicLibraryParams {
  handle: string;
  status?: string;
  favorites?: boolean;
  page?: number;
  limit?: number;
  /** Title or author (LOS-304). */
  q?: string;
  /** One category, as clicked on a pill. */
  subject?: string;
  /** One mood, and one theme, as clicked on their pills (LOS-342). */
  mood?: string;
  theme?: string;
}

/**
 * Matches GET /users/:handle/library (LOS-256).
 *
 * The rows are a subset of RawLibraryEntry: no notes, no review, no user_id --
 * those are absent from the stored function's row type, not stripped here. The
 * shared normalizer copes because it already treats every one of them as
 * optional.
 */
export function getPublicLibrary(
  { handle, status, favorites, page = 1, limit = 24, q, subject, mood, theme }: PublicLibraryParams,
  signal?: AbortSignal,
): Promise<{ entries: RawLibraryEntry[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);
  if (favorites) query.set('favorites', 'true');
  // Only when set: the API reads blank as absent anyway, but an empty q in the
  // URL makes two identical requests look different.
  if (q) query.set('q', q);
  if (subject) query.set('subject', subject);
  if (mood) query.set('mood', mood);
  if (theme) query.set('theme', theme);

  return apiFetch(`/users/${encodeURIComponent(handle)}/library?${query}`, { signal });
}

/**
 * The values this shelf's filters can take, over the whole shelf.
 *
 * Its own request rather than a field on the library response: the shelf is
 * refetched on every filter change and every page, and these do not move
 * between those. A caller cannot derive them from a page either -- it would
 * offer whichever values landed on the page it happens to hold.
 */
export interface ShelfFacets {
  subject: string[];
  mood: string[];
  theme: string[];
  status: string[];
}

export function getPublicLibraryFacets(handle: string, signal?: AbortSignal): Promise<ShelfFacets> {
  return apiFetch(`/users/${encodeURIComponent(handle)}/library/facets`, { signal });
}
