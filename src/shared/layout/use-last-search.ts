import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// The reader's most recent search of this visit, so the nav can offer a way
// back to it. sessionStorage rather than localStorage: a search is a thread of
// the current visit, and a Search entry pointing at last week's query would be
// a stale surprise on a cold open. Every access is guarded for the same reason
// as api/canned-searches/guest-state.ts — storage throws outright in Safari's
// private mode.
const LAST_SEARCH_STORAGE_KEY = 'bookhunt_last_search';

function readLastSearch(): string | null {
  try {
    return sessionStorage.getItem(LAST_SEARCH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLastSearch(url: string): void {
  try {
    sessionStorage.setItem(LAST_SEARCH_STORAGE_KEY, url);
  } catch {
    // The Search entry becomes session-scoped rather than reload-proof. It is
    // still there for as long as the page stays loaded.
  }
}

/**
 * The most recent search as a URL, or null before the reader has run one.
 *
 * Derived from the location rather than pushed in by whoever ran the search:
 * both nav renderers call this and see the same navigation, so neither has to
 * be told a search happened, and a search reached by any route — the Discover
 * hero, a pill, a shared link — counts the same.
 */
export function useLastSearch(): string | null {
  const { pathname, search } = useLocation();

  // A bare /search has no results behind it, so there is nothing to come back
  // to and it does not count as a search having been run. Any query string is
  // enough: results can come from q, or from a mood or subject on their own.
  const currentSearch = pathname === '/search' && search !== '' ? `${pathname}${search}` : null;

  useEffect(() => {
    if (currentSearch) writeLastSearch(currentSearch);
  }, [currentSearch]);

  // No state of its own: the caller re-renders on every navigation, so the
  // location answers for the search the reader is on, and storage — written by
  // the effect above while they were on it — answers for the one they have
  // since left. Where storage is unavailable the entry lasts only as long as
  // the reader is on the results, which is degraded but not broken.
  return currentSearch ?? readLastSearch();
}
