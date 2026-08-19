import { apiFetch } from '../client';
import type { CannedSearchRow } from './types';

export interface GetCannedSearchesParams {
  /** Total pills wanted, pinned included. The server defaults to 6. */
  limit?: number;
  /**
   * A guest's pinned ids, held in their browser. Ignored by the server when the
   * request carries a token — a signed-in reader's pins live in the database.
   */
  pinnedIds?: number[];
  /**
   * The row a guest is currently looking at, so it survives a reload. Ignored
   * when signed in, where the row is restored from the last recorded draw.
   */
  drawIds?: number[];
  /**
   * Draw a new row. Without it the server restores the row the reader was last
   * shown — the pills hold still until the reader asks for new ones.
   */
  refresh?: boolean;
  /** Ask for earlier draws too. Worth doing once per page load, not per refresh. */
  history?: boolean;
  /** Drops the answer when the caller unmounts mid-flight. */
  signal?: AbortSignal;
}

export function getCannedSearches({
  signal,
  ...params
}: GetCannedSearchesParams = {}): Promise<CannedSearchRow> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.pinnedIds?.length) query.set('pinnedIds', params.pinnedIds.join(','));
  if (params.drawIds?.length) query.set('drawIds', params.drawIds.join(','));
  if (params.refresh) query.set('refresh', 'true');
  if (params.history) query.set('history', 'true');
  const qs = query.toString();
  return apiFetch(`/canned-searches${qs ? `?${qs}` : ''}`, { signal });
}
