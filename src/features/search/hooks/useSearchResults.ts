import { useEffect, useState } from 'react';
import { aiSearch } from '../../../api/ai/search';
import { getMetadata } from '../../../api/search/get-metadata';
import { isAbortError } from '../../../api/client';
import { normalizeAiSearchResponse } from '../../../normalize/search';
import type { RawAiSearchBook, SearchResultItem } from '../../../normalize/search';
import { parseSearchParams } from '../search-params';
import type { LibraryStatus } from '../../../shared/types/library-status';

const RESULT_LIMIT = 20;

/**
 * /ai/search tries Claude first, which almost always succeeds — so most
 * results come back as bare title/author suggestions with no googleBooksId,
 * openLibraryId, or coverUrl at all. Resolve those against the real book APIs
 * via POST /search/metadata so results are viewable/clickable and show real
 * covers. Best-effort: if this fails, the original suggestions still render,
 * just without covers or a click target.
 *
 * /search/metadata only ever hits the Google Books/Open Library fallback
 * (never Claude), so its categories are comparatively sparse and its moods is
 * always [] — keep the richer /ai/search categories/moods and only take
 * identity/cover/rating/etc. fields from the metadata match.
 */
async function enrichWithMetadata(
  books: RawAiSearchBook[],
  signal: AbortSignal,
): Promise<RawAiSearchBook[]> {
  const unresolved = books
    .map((book, index) => ({ book, index }))
    .filter(({ book }) => !book.googleBooksId && !book.openLibraryId);
  if (unresolved.length === 0) return books;

  try {
    const response = await getMetadata(
      unresolved.map(({ book }) => ({ title: book.title, author: book.authors[0] })),
      signal,
    );
    const merged = [...books];
    unresolved.forEach(({ index }, metaIndex) => {
      const match = response.books[metaIndex];
      if (match) {
        merged[index] = { ...match, categories: books[index].categories, moods: books[index].moods };
      }
    });
    return merged;
  } catch (err) {
    if (isAbortError(err)) throw err;
    return books;
  }
}

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
        const enrichedBooks = await enrichWithMetadata(raw.books, controller.signal);
        setRawResults(normalizeAiSearchResponse({ ...raw, books: enrichedBooks }).results);
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
