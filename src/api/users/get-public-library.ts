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
  { handle, status, favorites, page = 1, limit = 24, q, subject }: PublicLibraryParams,
  signal?: AbortSignal,
): Promise<{ entries: RawLibraryEntry[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);
  if (favorites) query.set('favorites', 'true');
  // Only when set: the API reads blank as absent anyway, but an empty q in the
  // URL makes two identical requests look different.
  if (q) query.set('q', q);
  if (subject) query.set('subject', subject);

  return apiFetch(`/users/${encodeURIComponent(handle)}/library?${query}`, { signal });
}
