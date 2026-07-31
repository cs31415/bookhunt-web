import { apiFetch } from '../client';
import type { RawLibraryEntry, RawLibraryStats } from '../../normalize/library';

export interface GetLibraryParams {
  page?: number;
  limit?: number;
}

export interface GetLibraryResponse {
  entries: RawLibraryEntry[];
  stats: RawLibraryStats;
}

// GET /library paginates (LOS-118, max 60/page) - pass page/limit to walk it.
export function getLibrary(params: GetLibraryParams = {}): Promise<GetLibraryResponse> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch(`/library${qs ? `?${qs}` : ''}`);
}
