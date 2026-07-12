import type { BookSummary } from '../shared/types/book';

// GET /books?ids=... already camelCases its rows in the controller.
export interface RawBookSummary {
  id: number;
  slug: string;
  title: string;
  authorName: string;
  authorSlug: string;
  year: number | null;
  rating: number | null;
  coverUrl: string | null;
  hue: string;
}

export interface RawGetBooksByIdsResponse {
  books: RawBookSummary[];
}

export function normalizeBooksByIds(raw: RawGetBooksByIdsResponse): BookSummary[] {
  return raw.books.map((b) => ({ ...b, source: 'catalog' }));
}

export interface RawBookSummaryWithGoogleId extends RawBookSummary {
  googleBooksId: string;
}

export interface RawGetBooksByGoogleIdsResponse {
  books: RawBookSummaryWithGoogleId[];
}

/** Maps googleBooksId -> catalog slug, for resolving search results to an internal detail page. */
export function normalizeBooksByGoogleIds(raw: RawGetBooksByGoogleIdsResponse): Map<string, string> {
  return new Map(raw.books.map((b) => [b.googleBooksId, b.slug]));
}
