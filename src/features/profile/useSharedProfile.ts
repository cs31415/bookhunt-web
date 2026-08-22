import { useShelf } from './useShelf';
import type { ProfileFilters, ShelfView } from './useShelf';
import type { ProfileTab } from './useProfile';

export type SharedProfile = ShelfView;

/**
 * A profile at its unlisted address (LOS-305).
 *
 * The same shelf a visitor sees at /<handle>, reached by a token instead. It
 * was a near-copy of useVisitorProfile until LOS-310; both now go through
 * useShelf, because a copy is how the two came to need the same fix twice.
 *
 * Hidden books never arrive here — the API excludes them, exactly as it does
 * for the public shelf. Unlisted means "not listed", not "everything on show".
 */
export function useSharedProfile(
  token: string,
  tab: ProfileTab | null,
  page: number,
  pageSize: number,
  filters: ProfileFilters = { q: '', subject: '' },
): SharedProfile {
  return useShelf('token', token, tab, page, pageSize, filters);
}
