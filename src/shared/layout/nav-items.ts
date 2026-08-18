import type { ComponentType } from 'react';
import { HeartIcon, LibraryIcon, SearchIcon } from './icons';
import type { IconProps } from './icons';
import { useLastSearch } from './use-last-search';
import { useAuth } from '../../features/auth/AuthContext';

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
  const { user } = useAuth();

  const items: NavItem[] = [];
  if (lastSearch) items.push({ label: 'Search', path: '/search', to: lastSearch, Icon: SearchIcon });
  items.push(LIBRARY_ITEM);

  // A page of its own now, not the profile filtered (LOS-279). No handle in the
  // URL, so unlike before it survives a reader who has not set one — and it is
  // shown to anyone signed in, the way Library is.
  if (user) {
    items.push({
      label: 'Favourites',
      path: '/favorites',
      to: '/favorites',
      Icon: HeartIcon,
    });
  }

  return items;
}
