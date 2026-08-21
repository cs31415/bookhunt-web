import { apiFetch } from '../client';
import type { RawPublicProfile } from './get-profile';
import type { RawLibraryEntry } from '../../normalize/library';

/**
 * A profile at its unlisted address (LOS-305).
 *
 * The same rows the handle endpoints answer with, so the shared page renders
 * through the same normalizer and the same components. What differs is the
 * lookup: the token stands in for the handle, and works while the reader's
 * public page is off.
 *
 * 404 for an unknown token and a revoked one alike — a guess cannot be told
 * from a link that has been taken back.
 */
export function getProfileByToken(
  token: string,
  signal?: AbortSignal,
): Promise<{ profile: RawPublicProfile }> {
  return apiFetch(`/users/by-token/${encodeURIComponent(token)}`, { signal });
}

export interface TokenLibraryParams {
  token: string;
  status?: string;
  favorites?: boolean;
  page?: number;
  limit?: number;
  q?: string;
  subject?: string;
}

export function getLibraryByToken(
  { token, status, favorites, page = 1, limit = 24, q, subject }: TokenLibraryParams,
  signal?: AbortSignal,
): Promise<{ entries: RawLibraryEntry[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);
  if (favorites) query.set('favorites', 'true');
  if (q) query.set('q', q);
  if (subject) query.set('subject', subject);

  return apiFetch(`/users/by-token/${encodeURIComponent(token)}/library?${query}`, { signal });
}
