import { apiFetch } from '../client';
import type { RawGetBookResponse } from '../../normalize/book-detail';

export interface GetBookOptions {
  authorSlug?: string;
  pid?: string;
}

export function getBook(slug: string, options: GetBookOptions = {}): Promise<RawGetBookResponse> {
  const query = new URLSearchParams();
  if (options.authorSlug) query.set('a', options.authorSlug);
  if (options.pid) query.set('pid', options.pid);
  const qs = query.toString();
  return apiFetch(`/books/${slug}${qs ? `?${qs}` : ''}`);
}
