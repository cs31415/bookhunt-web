import { apiFetch } from '../client';
import type { RawCatalogSearchResponse } from '../../normalize/catalog-search';

export interface GetSearchParams {
  q?: string;
  subjects?: string[];
  moods?: string[];
  decade?: number;
  authorSlug?: string;
  status?: string;
  inLibraryOnly?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export function getSearch(params: GetSearchParams = {}): Promise<RawCatalogSearchResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  for (const subject of params.subjects ?? []) query.append('subjects', subject);
  for (const mood of params.moods ?? []) query.append('moods', mood);
  if (params.decade != null) query.set('decade', String(params.decade));
  if (params.authorSlug) query.set('authorSlug', params.authorSlug);
  if (params.status) query.set('status', params.status);
  if (params.inLibraryOnly) query.set('inLibraryOnly', 'true');
  if (params.sort) query.set('sort', params.sort);
  if (params.page != null) query.set('page', String(params.page));
  if (params.limit != null) query.set('limit', String(params.limit));
  const queryString = query.toString();
  return apiFetch(`/search${queryString ? `?${queryString}` : ''}`);
}
