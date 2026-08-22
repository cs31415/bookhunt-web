import { useShelf } from './useShelf';
import type { ProfileFilters, ShelfView } from './useShelf';

export type ProfileTab = 'library' | 'reading' | 'favorites';

export type { ProfileFilters };
export type VisitorProfile = ShelfView;

/**
 * A profile as a visitor sees it: paginated from the server, one request per
 * page rather than the whole shelf up front.
 *
 * The owner's own profile does not use this. It reads the private library
 * instead, because the public endpoint 404s whenever the page is off and the
 * owner would otherwise be locked out of their own profile.
 *
 * The fetching, and the reasons it works the way it does, live in useShelf --
 * shared with the unlisted address so the two cannot drift.
 */
export function useVisitorProfile(
  handle: string,
  tab: ProfileTab | null,
  page: number,
  pageSize: number,
  filters: ProfileFilters = { q: '', subject: '' },
): VisitorProfile {
  return useShelf('handle', handle, tab, page, pageSize, filters);
}
