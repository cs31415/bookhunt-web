import type { ComponentType } from 'react';
import { LibraryIcon, SearchIcon } from './icons';
import type { IconProps } from './icons';
import { useLastSearch } from './use-last-search';

export interface NavItem {
  label: string;
  /** The route this entry stands for — what marks it active. */
  path: string;
  /** Where the link goes: the same route, plus any state it carries. */
  to: string;
  Icon: ComponentType<IconProps>;
}

const LIBRARY_ITEM: NavItem = {
  label: 'Library',
  path: '/library',
  to: '/library',
  Icon: LibraryIcon,
};

/**
 * The primary nav, for the header and the mobile tab bar alike.
 *
 * Discover has no entry of its own: it is the index route, and the BookHunt
 * brand link already leads there. Search earns one only once the reader has run
 * a search (LOS-213) — until then the Discover hero is the way in, and a Search
 * entry would be a second door to the page they are already on. Afterwards it
 * is the way back to the results, so it carries the query with it.
 */
export function useNavItems(): NavItem[] {
  const lastSearch = useLastSearch();

  const items: NavItem[] = [];
  if (lastSearch) items.push({ label: 'Search', path: '/search', to: lastSearch, Icon: SearchIcon });
  items.push(LIBRARY_ITEM);

  // Favourites is deliberately absent: it lives in the account menu beside
  // Profile. Both are the reader's own things, where this nav is for where the
  // app takes you — and it leaves this hook with no reason to know who is
  // signed in.

  return items;
}
