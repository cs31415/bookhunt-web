import { apiFetch } from '../client';
import type { RawGetBooksByIdsResponse, RawGetBooksByGoogleIdsResponse } from '../../normalize/books-by-ids';

export function getBooksByIds(ids: number[]): Promise<RawGetBooksByIdsResponse> {
  return apiFetch(`/books?ids=${ids.join(',')}`);
}

export function getBooksByGoogleIds(googleBooksIds: string[]): Promise<RawGetBooksByGoogleIdsResponse> {
  return apiFetch(`/books?googleBooksIds=${googleBooksIds.map(encodeURIComponent).join(',')}`);
}
