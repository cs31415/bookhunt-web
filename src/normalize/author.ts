import type { BookSummary, BookSource } from '../shared/types/book';
import type { LibraryStatus } from '../shared/types/library-status';
import { hashToHue, hashToId } from '../shared/lib/hash';
import { slugify } from '../shared/lib/slugify';
import { toNumber } from '../shared/lib/to-number';

// GET /authors/:slug's `author` object is snake_case, but its `books` array
// is already camelCase (mapped in the controller). Catalog works carry a
// `bookId`/`slug`; provider works (resolved server-side from Google Books,
// OpenLibrary, etc.) may only carry provider ids. Both are rendered — the
// frontend is provider-agnostic and treats every returned work as first-class.
export interface RawAuthor {
  id: number;
  slug: string;
  name: string;
  birth_year: number | null;
  country: string | null;
  bio: string | null;
}

export interface RawAuthorWork {
  bookId?: number;
  slug?: string;
  title: string;
  year: number | null;
  rating: number | null;
  coverUrl: string | null;
  inLibrary: boolean;
  libraryStatus: LibraryStatus | null;
  // Present only for provider works that aren't in the catalog yet.
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  source?: BookSource;
}

export interface RawGetAuthorResponse {
  author: RawAuthor;
  books: RawAuthorWork[];
}

export interface AuthorDetail {
  id: number;
  slug: string;
  name: string;
  birthYear: number | null;
  country: string | null;
  bio: string | null;
}

export interface AuthorWork {
  book: BookSummary;
  status?: LibraryStatus;
}

export interface AuthorResult {
  author: AuthorDetail;
  works: AuthorWork[];
}

// GET /authors/:slug doesn't return a `hue` per catalog work; fall back to the
// catalog's default hue (matches fn_upsert_book.sql's COALESCE default).
const DEFAULT_HUE = '#6f7a55';

function normalizeWork(work: RawAuthorWork, author: AuthorDetail): AuthorWork {
  const isCatalog = work.bookId != null && work.slug != null;

  // Provider works have no catalog identity yet — derive a stable pseudo-id,
  // slug and hue the same way search results do (see normalize/search.ts).
  const seed = work.googleBooksId ?? work.openLibraryId ?? work.title;
  const source: BookSource = isCatalog
    ? 'catalog'
    : work.source ?? (work.googleBooksId ? 'google_books' : work.openLibraryId ? 'open_library' : 'catalog');

  const book: BookSummary = {
    id: isCatalog ? (work.bookId as number) : hashToId(seed),
    slug: isCatalog ? (work.slug as string) : slugify(work.title),
    title: work.title,
    authorName: author.name,
    authorSlug: author.slug,
    year: work.year,
    coverUrl: work.coverUrl,
    hue: isCatalog ? DEFAULT_HUE : hashToHue(seed),
    rating: toNumber(work.rating),
    source,
    googleBooksId: work.googleBooksId ?? null,
    openLibraryId: work.openLibraryId ?? null,
  };

  return {
    book,
    ...(work.inLibrary && work.libraryStatus ? { status: work.libraryStatus } : {}),
  };
}

export function normalizeAuthor(raw: RawGetAuthorResponse): AuthorResult {
  const author: AuthorDetail = {
    id: raw.author.id,
    slug: raw.author.slug,
    name: raw.author.name,
    birthYear: raw.author.birth_year,
    country: raw.author.country,
    bio: raw.author.bio,
  };

  const works: AuthorWork[] = raw.books.map((work) => normalizeWork(work, author));

  return { author, works };
}
