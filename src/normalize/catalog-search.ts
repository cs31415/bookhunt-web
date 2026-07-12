import type { BookSummary } from '../shared/types/book';
import type { LibraryStatus } from '../shared/types/library-status';

/**
 * Normalizes GET /search (catalog-only text search via fn_search_books).
 * Still used by RelatedPicker to find existing catalog books to link as
 * related — a genuinely different concern from the main Search page, which
 * now searches online via /ai/search (see normalize/search.ts).
 */
export interface RawCatalogSearchBook {
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

export interface RawCatalogSearchResponse {
  books: RawCatalogSearchBook[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

export interface CatalogSearchResultItem {
  book: BookSummary;
  status?: LibraryStatus;
}

export interface CatalogSearchResults {
  results: CatalogSearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

export function normalizeCatalogSearchBook(raw: RawCatalogSearchBook): CatalogSearchResultItem {
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

export function normalizeCatalogSearchResponse(raw: RawCatalogSearchResponse): CatalogSearchResults {
  return {
    results: raw.books.map(normalizeCatalogSearchBook),
    total: raw.total,
    page: raw.page,
    pageSize: raw.pageSize,
    query: raw.query,
  };
}
