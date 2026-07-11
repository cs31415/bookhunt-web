import type { BookSummary } from '../shared/types/book';
import type { LibraryStatus } from '../shared/types/library-status';

// GET /authors/:slug's `author` object is snake_case, but its `books` array
// is already camelCase (mapped in the controller). Non-catalog (external)
// works have no `bookId`/`slug` — those are filtered out below since Google
// Books integration is LOS-83's territory.
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
  catalogWorks: AuthorWork[];
}

// GET /authors/:slug doesn't return a `hue` per work; fall back to the
// catalog's default hue (matches fn_upsert_book.sql's COALESCE default).
const DEFAULT_HUE = '#6f7a55';

export function normalizeAuthor(raw: RawGetAuthorResponse): AuthorResult {
  const author: AuthorDetail = {
    id: raw.author.id,
    slug: raw.author.slug,
    name: raw.author.name,
    birthYear: raw.author.birth_year,
    country: raw.author.country,
    bio: raw.author.bio,
  };

  const catalogWorks: AuthorWork[] = raw.books
    .filter((work): work is RawAuthorWork & { bookId: number; slug: string } =>
      work.bookId != null && work.slug != null,
    )
    .map((work) => ({
      book: {
        id: work.bookId,
        slug: work.slug,
        title: work.title,
        authorName: author.name,
        authorSlug: author.slug,
        year: work.year,
        coverUrl: work.coverUrl,
        hue: DEFAULT_HUE,
        rating: work.rating,
        source: 'catalog',
      },
      ...(work.inLibrary && work.libraryStatus ? { status: work.libraryStatus } : {}),
    }));

  return { author, catalogWorks };
}
