import type { ComponentType } from 'react';
import { DiscoverIcon, LibraryIcon, SearchIcon } from './icons';
import type { IconProps } from './icons';

export interface NavItem {
  label: string;
  path: string;
  Icon: ComponentType<IconProps>;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Discover', path: '/', Icon: DiscoverIcon },
  { label: 'Search', path: '/search', Icon: SearchIcon },
  { label: 'Library', path: '/library', Icon: LibraryIcon },
];
