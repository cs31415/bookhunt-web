import type { ComponentType } from 'react';
import { DiscoverIcon, LibraryIcon } from './icons';
import type { IconProps } from './icons';

export interface NavItem {
  label: string;
  path: string;
  Icon: ComponentType<IconProps>;
}

// Search is deliberately absent (LOS-211). /search is still routable — the
// Discover hero search bar and the example pills both navigate there — it just
// no longer earns a slot in the nav.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Discover', path: '/', Icon: DiscoverIcon },
  { label: 'Library', path: '/library', Icon: LibraryIcon },
];
