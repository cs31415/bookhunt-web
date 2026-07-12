import type { BookSummary } from '../shared/types/book';
import type { LibraryStatus } from '../shared/types/library-status';

// GET /books/:slug does not camelCase its response (unlike /recommendations),
// so these Raw types reflect the actual snake_case shape returned by the API.
export interface RawBookDetail {
  id: number;
  slug: string;
  title: string;
  author_id: number;
  year: number | null;
  publisher: string | null;
  pages: number | null;
  rating: number | null;
  subjects: string[];
  moods: string[];
  genres: string[];
  themes: string[];
  hue: string;
  blurb: string;
  cover_url: string | null;
  google_books_id: string | null;
  isbn13: string | null;
  language: string | null;
  related: number[];
  author_name: string;
  author_slug: string;
  cataloged: boolean;
}

export interface RawBookLibraryEntry {
  status: LibraryStatus;
  user_rating: number | null;
  notes: string | null;
  review: string | null;
  user_related: number[];
}

export interface RawGetBookResponse {
  book: RawBookDetail;
  inLibrary: boolean;
  libraryEntry?: RawBookLibraryEntry;
}

export interface BookDetail extends BookSummary {
  publisher: string | null;
  pages: number | null;
  subjects: string[];
  moods: string[];
  genres: string[];
  themes: string[];
  blurb: string;
  googleBooksId: string | null;
  isbn13: string | null;
  language: string | null;
  relatedIds: number[];
  cataloged: boolean;
}

export interface LibraryEntrySummary {
  status: LibraryStatus;
  userRating: number | null;
  notes: string | null;
  userRelatedIds: number[];
}

export interface BookDetailResult {
  book: BookDetail;
  inLibrary: boolean;
  libraryEntry?: LibraryEntrySummary;
}

export function normalizeBookDetail(raw: RawGetBookResponse): BookDetailResult {
  const b = raw.book;
  return {
    inLibrary: raw.inLibrary,
    book: {
      id: b.id,
      slug: b.slug,
      title: b.title,
      authorName: b.author_name,
      authorSlug: b.author_slug,
      year: b.year,
      coverUrl: b.cover_url,
      hue: b.hue,
      rating: b.rating,
      source: 'catalog',
      publisher: b.publisher,
      pages: b.pages,
      subjects: b.subjects,
      moods: b.moods,
      genres: b.genres,
      themes: b.themes,
      blurb: b.blurb,
      googleBooksId: b.google_books_id,
      isbn13: b.isbn13,
      language: b.language,
      relatedIds: b.related,
      cataloged: b.cataloged,
    },
    ...(raw.libraryEntry && {
      libraryEntry: {
        status: raw.libraryEntry.status,
        userRating: raw.libraryEntry.user_rating,
        notes: raw.libraryEntry.notes,
        userRelatedIds: raw.libraryEntry.user_related,
      },
    }),
  };
}
