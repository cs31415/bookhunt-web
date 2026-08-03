import { apiFetch } from '../client';

export interface RemoveEntriesResponse {
  /** How many entries were actually deleted. */
  removed: number;
  /** How many distinct ids the server was asked for. */
  requested: number;
}

/** Server-side cap on DELETE /library/bulk; callers must chunk beyond this. */
export const MAX_REMOVE_PER_REQUEST = 20;

/**
 * Removes several books from the library in one request (LOS-201).
 *
 * `removed` can be lower than `requested` — an id the caller does not own
 * matches nothing, which the server reports rather than failing over.
 */
export function removeEntries(bookIds: number[]): Promise<RemoveEntriesResponse> {
  return apiFetch('/library/bulk', {
    method: 'DELETE',
    body: JSON.stringify({ bookIds }),
  });
}
