import { apiFetch } from '../client';

export interface CategorizeResponse {
  categorized: number;
}

/**
 * Tags a set of books in one go, at the end of an import.
 *
 * An import adds books one request at a time and several at once, so the server
 * never sees the whole set — and a model asked about a single book describes
 * that book, while only a batch lets it notice what several of them have in
 * common. This call is that batch (LOS-197).
 */
export function categorizeBooks(bookIds: number[]): Promise<CategorizeResponse> {
  return apiFetch('/ai/categorize', {
    method: 'POST',
    body: JSON.stringify({ bookIds }),
  });
}
