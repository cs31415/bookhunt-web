import { apiFetch } from '../client';
import type { RawGetBookResponse } from '../../normalize/book-detail';

export function getBook(slug: string, authorSlug?: string): Promise<RawGetBookResponse> {
  const query = authorSlug ? `?a=${encodeURIComponent(authorSlug)}` : '';
  return apiFetch(`/books/${slug}${query}`);
}
