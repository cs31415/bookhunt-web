import { apiFetch } from '../client';
import type { RawLibraryEntry } from '../../normalize/library';

/**
 * One reader's entry for one book, as a visitor may see it (LOS-360).
 *
 * Their status, their rating, and their review only if they published it: the
 * gate is in the SQL, so an unshared review arrives null exactly as it does on
 * their shelf.
 *
 * 404 is the one answer for every way this can be unavailable -- no such
 * reader, a page not listed, a book they do not have, one they hid. A visitor
 * cannot tell those apart, so neither does this.
 */
export function getPublicEntry(
  handle: string,
  bookId: number,
  signal?: AbortSignal,
): Promise<{ entry: RawLibraryEntry }> {
  return apiFetch(`/users/${encodeURIComponent(handle)}/library/${bookId}`, { signal });
}
