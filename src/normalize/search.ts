import type { BookSummary } from '../shared/types/book';
import type { LibraryStatus } from '../shared/types/library-status';

export interface RawSearchBook {
  book_id: number;
  slug: string;
  title: string;
  author_name: string;
  author_slug: string;
  year: number | null;
  rating: number | null;
  cover_url: string | null;
  hue: string;
  in_library: boolean;
  library_status: LibraryStatus | null;
}

export interface RawSearchResponse {
  books: RawSearchBook[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

export interface SearchResultItem {
  book: BookSummary;
  status?: LibraryStatus;
}

export interface SearchResults {
  results: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

export function normalizeSearchBook(raw: RawSearchBook): SearchResultItem {
  return {
    book: {
      id: raw.book_id,
      slug: raw.slug,
      title: raw.title,
      authorName: raw.author_name,
      authorSlug: raw.author_slug,
      year: raw.year,
      coverUrl: raw.cover_url,
      hue: raw.hue,
      rating: raw.rating,
      source: 'catalog',
    },
    ...(raw.in_library && raw.library_status ? { status: raw.library_status } : {}),
  };
}

export function normalizeSearchResponse(raw: RawSearchResponse): SearchResults {
  return {
    results: raw.books.map(normalizeSearchBook),
    total: raw.total,
    page: raw.page,
    pageSize: raw.pageSize,
    query: raw.query,
  };
}
