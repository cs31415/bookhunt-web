import { apiFetch } from '../client';
import type { RawGetBookResponse } from '../../normalize/book-detail';

export function getBook(slug: string): Promise<RawGetBookResponse> {
  return apiFetch(`/books/${slug}`);
}
