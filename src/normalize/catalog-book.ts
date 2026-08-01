import type { BookSummary } from '../shared/types/book';
import { toNumber } from '../shared/lib/to-number';

/**
 * A catalog book as the API sends it — already camelCased server-side, and the
 * same shape wherever it appears: GET /books, and the `matchedBook` on an
 * import-resolve row.
 */
export interface RawCatalogBook {
  id: number;
  slug: string;
  title: string;
  authorName: string;
  authorSlug: string;
  year: number | null;
  /** NUMERIC arrives as a string from the driver. */
  rating: number | string | null;
  coverUrl: string | null;
  hue: string;
}

export function normalizeCatalogBook(raw: RawCatalogBook): BookSummary {
  return { ...raw, rating: toNumber(raw.rating), source: 'catalog' };
}
