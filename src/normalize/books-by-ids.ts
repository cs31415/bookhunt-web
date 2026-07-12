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
