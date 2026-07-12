import { useEffect, useState } from 'react';
import { aiSearch } from '../../../api/ai/search';
import { getMetadata } from '../../../api/search/get-metadata';
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
 */
async function enrichWithMetadata(books: RawAiSearchBook[]): Promise<RawAiSearchBook[]> {
  const unresolved = books
    .map((book, index) => ({ book, index }))
    .filter(({ book }) => !book.googleBooksId && !book.openLibraryId);
  if (unresolved.length === 0) return books;

  try {
    const response = await getMetadata(
      unresolved.map(({ book }) => ({ title: book.title, author: book.authors[0] })),
    );
    const merged = [...books];
    unresolved.forEach(({ index }, metaIndex) => {
      const match = response.books[metaIndex];
      if (match) merged[index] = match;
    });
    return merged;
  } catch {
    return books;
  }
}

export interface UseSearchResultsResult {
  results: SearchResultItem[];
  loading: boolean;
  error: string | null;
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

function applyStatusAndSort(
  results: SearchResultItem[],
  status: LibraryStatus | null,
  sort: string,
): SearchResultItem[] {
  const filtered = status ? results.filter((item) => item.status === status) : results;
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
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const raw = await aiSearch({
          query: parsed.q,
          inLibraryOnly: parsed.inLibraryOnly,
          limit: RESULT_LIMIT,
        });
        if (cancelled) return;
        const enrichedBooks = await enrichWithMetadata(raw.books);
        if (cancelled) return;
        setRawResults(normalizeAiSearchResponse({ ...raw, books: enrichedBooks }).results);
      } catch {
        if (!cancelled) setError('Could not load search results. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  if (!parsed.q) {
    return { results: [], loading: false, error: null };
  }

  return {
    results: applyStatusAndSort(rawResults, parsed.status, parsed.sort),
    loading,
    error,
  };
}
