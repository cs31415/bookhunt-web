import { apiFetch } from '../client';
import type { RawGetBooksByIdsResponse } from '../../normalize/books-by-ids';

export function getBooksByIds(ids: number[]): Promise<RawGetBooksByIdsResponse> {
  return apiFetch(`/books?ids=${ids.join(',')}`);
}
