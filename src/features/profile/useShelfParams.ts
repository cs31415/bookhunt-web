import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from '../../shared/hooks/useDebouncedCallback';
import type { ProfileTab } from './useProfile';

/**
 * Favourites hold two kinds of thing, so they carry a second row rather than a
 * fourth tab. Authors are public — a list of authors reads as taste, not as a
 * social graph (LOS-255) — which is why they live here and favourite *readers*
 * do not appear on this page at all (LOS-279).
 */
export type FavoritesSub = 'books' | 'authors';

/** Books per page, on every profile shelf. */
export const PAGE_SIZE = 24;

export const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'reading', label: 'Currently reading' },
  { id: 'favorites', label: 'Favourites' },
];

export const SUB_TABS: { id: FavoritesSub; label: string }[] = [
  { id: 'books', label: 'Books' },
  { id: 'authors', label: 'Authors' },
];

/** True when the section on screen is the authors list rather than a shelf. */
export function showsAuthors(tab: ProfileTab, sub: FavoritesSub): boolean {
  return tab === 'favorites' && sub === 'authors';
}

function asTab(value: string | null): ProfileTab {
  return TABS.some((t) => t.id === value) ? (value as ProfileTab) : 'library';
}

function asSub(value: string | null): FavoritesSub {
  return value === 'authors' ? 'authors' : 'books';
}

export interface ShelfParams {
  tab: ProfileTab;
  sub: FavoritesSub;
  page: number;
  /** What is in the box, which may be ahead of the shelf while typing. */
  q: string;
  /** What the shelf is actually filtered by — the committed query. */
  appliedQuery: string;
  subject: string;
  onSelectTab: (tab: ProfileTab) => void;
  onSelectSub: (sub: FavoritesSub) => void;
  onPage: (page: number) => void;
  onQueryChange: (value: string) => void;
  onSelectSubject: (subject: string) => void;
}

/**
 * Which slice of a shelf is on screen, held in the query string so it can be
 * linked and so Back behaves.
 *
 * Shared by the profile at a handle and the one at a share token (LOS-305):
 * the two differ in where the books come from, not in how a reader moves
 * around them, and a second copy of this would drift.
 */
export function useShelfParams(): ShelfParams {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);

  const tab = asTab(searchParams.get('tab'));
  const sub = asSub(searchParams.get('sub'));
  const urlQuery = searchParams.get('q') ?? '';
  const subject = searchParams.get('subject') ?? '';

  // The box is driven by local state, not by the URL: setSearchParams lands a
  // render later, so feeding it straight from the URL makes every keystroke
  // start from a stale value. The same shape the library page uses.
  const [q, setQ] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (urlQuery !== q) setQ(urlQuery);
  }

  /**
   * Debounced, because for a visitor this is a request rather than an in-memory
   * filter — a request per keystroke would be several for one word.
   *
   * Replaces rather than pushes: a history entry per keystroke makes Back
   * unusable. The query still reaches the URL, so a filtered shelf can be
   * linked, which is the point of keeping it there at all.
   */
  const commitQuery = useDebouncedCallback((value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('q', value);
    else params.delete('q');
    setSearchParams(params, { replace: true });
    setPage(1);
  }, 300);

  useEffect(() => {
    if (q !== urlQuery) commitQuery(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  /**
   * Pushes where typing replaces: clicking a pill is one deliberate act, and
   * Back undoing it is exactly what a reader expects. Clicking the same pill
   * again clears it, the way the library's category pills already behave.
   */
  function onSelectSubject(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next && next !== subject) params.set('subject', next);
    else params.delete('subject');
    setSearchParams(params);
    setPage(1);
  }

  function onSelectTab(next: ProfileTab) {
    const params = new URLSearchParams(searchParams);
    if (next === 'library') params.delete('tab');
    else params.set('tab', next);
    // The sub-tab belongs to Favourites, so it leaves with it rather than
    // lying in wait to reopen on Authors next time Favourites is picked.
    if (next !== 'favorites') params.delete('sub');
    setSearchParams(params, { replace: true });
    setPage(1);
  }

  function onSelectSub(next: FavoritesSub) {
    const params = new URLSearchParams(searchParams);
    if (next === 'books') params.delete('sub');
    else params.set('sub', next);
    setSearchParams(params, { replace: true });
    setPage(1);
  }

  return {
    tab,
    sub,
    page,
    q,
    appliedQuery: urlQuery,
    subject,
    onSelectTab,
    onSelectSub,
    onPage: setPage,
    onQueryChange: setQ,
    onSelectSubject,
  };
}
