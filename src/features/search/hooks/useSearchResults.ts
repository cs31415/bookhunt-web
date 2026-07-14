import { useEffect, useState } from 'react';
import { aiSearch } from '../../../api/ai/search';
import { isAbortError } from '../../../api/client';
import { normalizeAiSearchResponse } from '../../../normalize/search';
import type { SearchResultItem } from '../../../normalize/search';
import { parseSearchParams } from '../search-params';
import type { LibraryStatus } from '../../../shared/types/library-status';

const RESULT_LIMIT = 20;

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

export function useSearchResults(searchParams: URLSearchParams): UseSearchResultsResult {
  const [rawResults, setRawResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (!parsed.q) {
    return { results: [], loading: false, error: null, availableCategories: [], availableMoods: [] };
  }

  return {
    results: applyFiltersAndSort(rawResults, parsed.status, parsed.subject, parsed.mood, parsed.sort),
    loading,
    error,
    availableCategories: topTags(rawResults, 'categories'),
    availableMoods: topTags(rawResults, 'moods'),
  };
}
