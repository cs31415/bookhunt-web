import { apiFetch } from '../client';
import type { RawLibraryEntry } from '../../normalize/library';

export interface SearchLibraryParams {
  /**
   * Optional: the API treats an absent query as a filter-only browse, with
   * `terms` and `phrase` null and the sort defaulting to `added`. That is how
   * Discover asks for "everything I am currently reading" without a search box.
   */
  q?: string;
  status?: string;
  sort?: string;
  limit?: number;
}

export interface SearchLibraryResponse {
  /** Same shape as GET /library entries, plus a `relevance` score. */
  entries: RawLibraryEntry[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

// GET /library/search (LOS-182) is Postgres-only — no LLM — so it answers in
// milliseconds where /ai/search takes seconds.
export function searchLibrary(
  params: SearchLibraryParams,
  signal?: AbortSignal,
): Promise<SearchLibraryResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.sort) query.set('sort', params.sort);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  return apiFetch(`/library/search?${query.toString()}`, { signal });
}
