import { useEffect, useState } from 'react';
import { aiSearch } from '../../../api/ai/search';
import { searchLibrary } from '../../../api/library/search-library';
import { isAbortError } from '../../../api/client';
import {
  normalizeAiSearchResponse,
  normalizeLibraryEntryToSearchResult,
} from '../../../normalize/search';
import type { SearchResultItem } from '../../../normalize/search';
import { parseSearchParams } from '../search-params';
import type { LibraryStatus } from '../../../shared/types/library-status';

const RESULT_LIMIT = 20;

const LIBRARY_RESULT_LIMIT = 24;

const MAX_FILTER_TAGS = 8;

/** Suggestion sets held for the session, so a repeat query is free. */
const MAX_CACHED_QUERIES = 50;

/**
 * The query alone. Normalising folds "Carl Sagan", "carl sagan " and
 * "Carl  Sagan" onto one entry.
 *
 * seedCategory and seedMood are still sent, and do shape the prompt, but they
 * are deliberately not part of this key: the category and mood pills have
 * always filtered the fetched batch client-side rather than re-querying, and
 * keying on them would turn every pill click into another LLM call — the
 * opposite of the point. The cost is that a set fetched with a seed can be
 * reused without it, which only changes which tags the suggestions carry.
 */
function cacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Module-level, so it survives navigating away and back — which is the point.
 * The query lives in the URL and there is no client cache anywhere else, so
 * every back, forward and reload was another few seconds of LLM.
 */
const suggestionCache = new Map<string, SearchResultItem[]>();

function writeCache(key: string, results: SearchResultItem[]): void {
  // An empty set means the LLM failed (searchBooksWithLlm swallows and returns
  // []), so caching it would pin a transient failure for the whole session.
  if (results.length === 0) return;
  suggestionCache.set(key, results);
  // Oldest-first eviction rather than least-recently-used: an LRU would have to
  // reorder on read, and reads happen during render.
  if (suggestionCache.size > MAX_CACHED_QUERIES) {
    suggestionCache.delete(suggestionCache.keys().next().value as string);
  }
}

/** Exposed for tests; a page reload clears it anyway. */
export function clearSuggestionCache(): void {
  suggestionCache.clear();
}

function topTags(results: SearchResultItem[], field: 'categories' | 'moods'): string[] {
  const counts = new Map<string, number>();
  for (const item of results) {
    for (const tag of item[field]) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_FILTER_TAGS)
    .map(([tag]) => tag);
}

export interface UseSearchResultsResult {
  /** Keyword hits from the caller's own library. Empty when signed out. */
  libraryResults: SearchResultItem[];
  libraryLoading: boolean;
  results: SearchResultItem[];
  loading: boolean;
  error: string | null;
  availableCategories: string[];
  availableMoods: string[];
}

function sortResults(results: SearchResultItem[], sort: string): SearchResultItem[] {
  const withIndex = results.map((item, index) => ({ item, index }));
  const compare: Record<string, (a: typeof withIndex[number], b: typeof withIndex[number]) => number> = {
    rating: (a, b) => (b.item.book.rating ?? -Infinity) - (a.item.book.rating ?? -Infinity),
    newest: (a, b) => (b.item.book.year ?? -Infinity) - (a.item.book.year ?? -Infinity),
    oldest: (a, b) => (a.item.book.year ?? Infinity) - (b.item.book.year ?? Infinity),
    title: (a, b) => a.item.book.title.localeCompare(b.item.book.title),
  };
  const comparator = compare[sort];
  if (!comparator) return results;
  return [...withIndex]
    .sort((a, b) => comparator(a, b) || a.index - b.index)
    .map(({ item }) => item);
}

function applyFiltersAndSort(
  results: SearchResultItem[],
  status: LibraryStatus | null,
  category: string | null,
  mood: string | null,
  sort: string,
  inLibraryOnly: boolean,
): SearchResultItem[] {
  let filtered = results;
  // `status` is set only for books the caller owns, which is the same signal the
  // server used to apply this filter — and applying it here means the toggle no
  // longer costs an LLM round trip for an identical prompt.
  if (inLibraryOnly) filtered = filtered.filter((item) => item.status);
  if (status) filtered = filtered.filter((item) => item.status === status);
  if (category) filtered = filtered.filter((item) => item.categories.includes(category));
  if (mood) filtered = filtered.filter((item) => item.moods.includes(mood));
  return sortResults(filtered, sort);
}

export function useSearchResults(
  searchParams: URLSearchParams,
  isAuthenticated = false,
): UseSearchResultsResult {
  // Tagged with the key it answered, so a fetch that lands after the query moved
  // on cannot be shown against the wrong query.
  const [answered, setAnswered] = useState<{ key: string; items: SearchResultItem[] } | null>(null);
  // Tagged with the query it answered, so a result set is never shown against a
  // query it wasn't for — the previous library hits would otherwise linger for
  // a frame after the query changes, and clearing them in the effect would mean
  // a setState in the effect body on every render.
  const [library, setLibrary] = useState<{ query: string; items: SearchResultItem[] }>({
    query: '',
    items: [],
  });
  const [loading, setLoading] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseSearchParams(searchParams);
  // inLibraryOnly is deliberately absent. It never reached the LLM — the server
  // omits it from the prompt and applies it as a post-filter — so keying the
  // fetch on it bought an identical prompt at full price every time the toggle
  // moved. It is a client-side filter now, which is what search-params.ts said
  // it already was.
  const fetchKey = cacheKey(parsed.q);

  const cachedResults = suggestionCache.get(fetchKey);

  useEffect(() => {
    // Already answered this exact prompt — render reads it straight from the
    // cache below, so there is nothing to fetch and no state to set.
    if (!parsed.q || suggestionCache.has(fetchKey)) return;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const raw = await aiSearch(
          {
            query: parsed.q,
            limit: RESULT_LIMIT,
            seedCategory: parsed.subject ?? undefined,
            seedMood: parsed.mood ?? undefined,
          },
          controller.signal,
        );
        const items = normalizeAiSearchResponse(raw).results;
        writeCache(fetchKey, items);
        setAnswered({ key: fetchKey, items });
      } catch (err) {
        if (isAbortError(err)) return;
        setError('Could not load search results. Please try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  // Deliberately its own effect, running in parallel with the LLM call above
  // rather than after it: this one answers in milliseconds, and the whole point
  // is that "Sagan" shows the Sagan you own without waiting seconds for a model
  // to guess at it. A failure here is silent — the AI results still render, and
  // an error banner for a supplementary section would be noise.
  const libraryQuery = isAuthenticated ? parsed.q : '';

  useEffect(() => {
    if (!libraryQuery) return;
    const controller = new AbortController();

    async function loadLibrary() {
      setLibraryLoading(true);
      try {
        const raw = await searchLibrary(
          { q: libraryQuery, limit: LIBRARY_RESULT_LIMIT },
          controller.signal,
        );
        setLibrary({ query: libraryQuery, items: raw.entries.map(normalizeLibraryEntryToSearchResult) });
      } catch (err) {
        if (isAbortError(err)) return;
        setLibrary({ query: libraryQuery, items: [] });
      } finally {
        if (!controller.signal.aborted) setLibraryLoading(false);
      }
    }

    loadLibrary();
    return () => {
      controller.abort();
    };
  }, [libraryQuery]);

  if (!parsed.q) {
    return {
      libraryResults: [],
      libraryLoading: false,
      results: [],
      loading: false,
      error: null,
      availableCategories: [],
      availableMoods: [],
    };
  }

  // A cache hit is the answer outright: nothing was fetched, so nothing is
  // loading. Otherwise only the set tagged with the current key counts, so a
  // stale answer never shows against a query it wasn't for.
  const rawResults = cachedResults ?? (answered?.key === fetchKey ? answered.items : []);
  const isLoading = cachedResults ? false : loading;

  // Status and sort are library-native and apply cleanly. Category and mood are
  // not: those pills are derived from the tags on the AI results, a different
  // vocabulary from the catalog's subjects, so applying them here would empty
  // the section for reasons the user can't see.
  const rawLibraryResults = library.query === libraryQuery ? library.items : [];
  const libraryResults = sortResults(
    parsed.status
      ? rawLibraryResults.filter((item) => item.status === parsed.status)
      : rawLibraryResults,
    parsed.sort,
  );

  // A book the caller owns is already shown, more accurately, in the section
  // above — the LLM offers a title and an author, the library search matched
  // against the real row. `status` is set only for owned books, so this drops
  // exactly the overlap without a second round of title matching here.
  const aiResults = libraryResults.length > 0 ? rawResults.filter((item) => !item.status) : rawResults;

  return {
    libraryResults,
    libraryLoading,
    results: applyFiltersAndSort(
      aiResults,
      parsed.status,
      parsed.subject,
      parsed.mood,
      parsed.sort,
      parsed.inLibraryOnly,
    ),
    loading: isLoading,
    error,
    availableCategories: topTags(rawResults, 'categories'),
    availableMoods: topTags(rawResults, 'moods'),
  };
}
