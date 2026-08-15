import { apiFetch } from '../client';
import type { RawLibraryEntry } from '../../normalize/library';

export interface PublicLibraryParams {
  handle: string;
  status?: string;
  favorites?: boolean;
  page?: number;
  limit?: number;
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
  { handle, status, favorites, page = 1, limit = 24 }: PublicLibraryParams,
  signal?: AbortSignal,
): Promise<{ entries: RawLibraryEntry[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);
  if (favorites) query.set('favorites', 'true');

  return apiFetch(`/users/${encodeURIComponent(handle)}/library?${query}`, { signal });
}
