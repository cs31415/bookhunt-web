import { useEffect, useState } from 'react';
import { getSearch } from '../../../api/search/get-search';
import { normalizeSearchResponse } from '../../../normalize/search';
import type { SearchResultItem } from '../../../normalize/search';
import { parseSearchParams, toFetchParams } from '../search-params';

export interface UseSearchResultsResult {
  results: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
}

export function useSearchResults(searchParams: URLSearchParams): UseSearchResultsResult {
  const [state, setState] = useState<Omit<UseSearchResultsResult, 'loading' | 'error'>>({
    results: [],
    total: 0,
    page: 1,
    pageSize: 24,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = searchParams.toString();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const parsed = parseSearchParams(new URLSearchParams(key));
        const raw = await getSearch(toFetchParams(parsed));
        if (cancelled) return;
        const normalized = normalizeSearchResponse(raw);
        setState({
          results: normalized.results,
          total: normalized.total,
          page: normalized.page,
          pageSize: normalized.pageSize,
        });
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
  }, [key]);

  return { ...state, loading, error };
}
