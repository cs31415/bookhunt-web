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
): SearchResultItem[] {
  let filtered = results;
  if (status) filtered = filtered.filter((item) => item.status === status);
  if (category) filtered = filtered.filter((item) => item.categories.includes(category));
  if (mood) filtered = filtered.filter((item) => item.moods.includes(mood));
  return sortResults(filtered, sort);
}

export function useSearchResults(
  searchParams: URLSearchParams,
  isAuthenticated = false,
): UseSearchResultsResult {
  const [rawResults, setRawResults] = useState<SearchResultItem[]>([]);
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
  const fetchKey = `${parsed.q}::${parsed.inLibraryOnly}`;

  useEffect(() => {
    if (!parsed.q) return;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const raw = await aiSearch(
          {
            query: parsed.q,
            inLibraryOnly: parsed.inLibraryOnly,
            limit: RESULT_LIMIT,
            seedCategory: parsed.subject ?? undefined,
            seedMood: parsed.mood ?? undefined,
          },
          controller.signal,
        );
        setRawResults(normalizeAiSearchResponse(raw).results);
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
    results: applyFiltersAndSort(aiResults, parsed.status, parsed.subject, parsed.mood, parsed.sort),
    loading,
    error,
    availableCategories: topTags(rawResults, 'categories'),
    availableMoods: topTags(rawResults, 'moods'),
  };
}
