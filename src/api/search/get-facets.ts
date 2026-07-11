import { apiFetch } from '../client';

export interface GetFacetsResponse {
  subjects: string[];
  moods: string[];
}

export function getFacets(): Promise<GetFacetsResponse> {
  return apiFetch('/search/facets');
}
