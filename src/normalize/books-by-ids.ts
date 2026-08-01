import type { BookSummary } from '../shared/types/book';
import { normalizeCatalogBook } from './catalog-book';
import type { RawCatalogBook } from './catalog-book';

export interface RawGetBooksByIdsResponse {
  books: RawCatalogBook[];
}

export function normalizeBooksByIds(raw: RawGetBooksByIdsResponse): BookSummary[] {
  return raw.books.map(normalizeCatalogBook);
}
