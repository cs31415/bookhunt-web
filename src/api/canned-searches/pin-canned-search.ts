import { apiFetch } from '../client';
import type { CannedSearch } from './types';

/** Throws ApiError 409 when the reader is already at the pin limit. */
export function pinCannedSearch(id: number): Promise<CannedSearch> {
  return apiFetch(`/canned-searches/${id}/pin`, { method: 'POST' });
}

export function unpinCannedSearch(id: number): Promise<void> {
  return apiFetch(`/canned-searches/${id}/pin`, { method: 'DELETE' });
}

/**
 * Save a search the reader typed as one of their own pills.
 *
 * The server pins it as part of saving — a saved search is never drawn as a
 * suggestion, so an unpinned one would be invisible the moment it was made.
 * Throws ApiError 409 at the pin limit, 400 if the text is empty or too long.
 */
export function saveCannedSearch(query: string): Promise<CannedSearch> {
  return apiFetch('/canned-searches', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}
