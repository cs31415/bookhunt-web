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

  // Points at the reader's own profile, where favourites live (LOS-259).
  // Hidden entirely when signed out, unlike Library, which shows and bounces:
  // there is no handle to build a URL from, so the link would go nowhere.
  if (user?.handle) {
    items.push({
      label: 'Favourites',
      path: `/${user.handle}`,
      to: `/${user.handle}?tab=favorites`,
      Icon: HeartIcon,
    });
  }

  return items;
}
