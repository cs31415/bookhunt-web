import type { BookSummary } from '../shared/types/book';
import type { LibraryStatus } from '../shared/types/library-status';
import { hashToHue, hashToId } from '../shared/lib/hash';

export interface RawAiSearchBook {
  googleBooksId: string | null;
  openLibraryId: string | null;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  pages: number | null;
  rating: number | null;
  coverUrl: string | null;
  isbn13: string | null;
  language: string | null;
  blurb: string | null;
  categories: string[];
  moods: string[];
  inLibrary: boolean;
  libraryStatus: LibraryStatus | null;
  source: string;
}

export interface RawAiSearchResponse {
  books: RawAiSearchBook[];
  query: string;
}

export interface SearchResultItem {
  book: BookSummary;
  status?: LibraryStatus;
  categories: string[];
  moods: string[];
}

export interface SearchResults {
  results: SearchResultItem[];
  query: string;
}

export function normalizeAiSearchBook(raw: RawAiSearchBook): SearchResultItem {
  const seed = raw.googleBooksId ?? raw.openLibraryId ?? raw.isbn13 ?? raw.title;
  return {
    book: {
      id: hashToId(seed),
      slug: '',
      title: raw.title,
      authorName: raw.authors.join(', ') || 'Unknown',
      authorSlug: '',
      year: raw.year,
      coverUrl: raw.coverUrl,
      hue: hashToHue(seed),
      rating: raw.rating,
      source: raw.googleBooksId ? 'google_books' : raw.openLibraryId ? 'open_library' : 'catalog',
    },
    categories: raw.categories,
    moods: raw.moods,
    ...(raw.inLibrary && raw.libraryStatus ? { status: raw.libraryStatus } : {}),
  };
}

export function normalizeAiSearchResponse(raw: RawAiSearchResponse): SearchResults {
  return {
    results: raw.books.map(normalizeAiSearchBook),
    query: raw.query,
  };
}
