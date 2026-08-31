import type { BookSummary } from '../shared/types/book';
import type { LibraryStatus } from '../shared/types/library-status';
import { toNumber } from '../shared/lib/to-number';

export interface RawLibraryEntry {
  book_id: number;
  status: LibraryStatus;
  // Absent on a public profile row (LOS-256): review is not a column of
  // fn_get_public_library at all, so it cannot arrive by any route.
  review?: string | null;
  title: string;
  book_slug: string;
  author_name: string;
  author_slug: string;
  year: number | null;
  rating: number | null;
  // The reader's own score, beside the catalog's `rating`. Both library
  // functions return it; a source with no library rows (Discover, AI
  // suggestions) carries neither.
  user_rating?: number | null;
  cover_url: string | null;
  hue: string;
  // Optional: only the Library page (LOS-81) consumes these; Discover's fixtures omit them.
  subjects?: string[] | null;
  date_added?: string | null;
  // Returned by /library and /library/search; used when a library row is shown
  // alongside AI suggestions, which carry the same two tag lists, and by the
  // library's own mood/theme filters.
  moods?: string[] | null;
  themes?: string[] | null;
  // Optional for the same reason as subjects: Discover's fixtures and the AI
  // suggestion rows carry no library flags, only /library and /library/search
  // do (LOS-249).
  is_favorite?: boolean | null;
  is_hidden?: boolean | null;
  is_ebook?: boolean | null;
  is_audiobook?: boolean | null;
}

export interface RawLibraryStats {
  total: number;
  by_status: Partial<Record<LibraryStatus, number>>;
}

export interface LibraryEntry {
  book: BookSummary;
  status: LibraryStatus;
  /** What this reader gave the book, where book.rating is what the catalog says. */
  userRating: number | null;
  /**
   * The reader's own words. Called notes until LOS-266.
   *
   * On a public shelf this arrives only when they published it -- the SQL gate
   * in fn_get_public_library returns NULL otherwise, which is the same thing a
   * visitor sees for a book with no review at all.
   */
  review: string | null;
  subjects: string[];
  moods: string[];
  themes: string[];
  addedAt: string | null;
  isFavorite: boolean;
  /** Excluded from the public profile. No effect on this, the owner's own view. */
  isHidden: boolean;
  /** The copy on the shelf is an ebook. False is a physical book (LOS-271). */
  isEbook: boolean;
  /** Independent of isEbook — a reader can own both. Neither is physical. */
  isAudiobook: boolean;
}

export function normalizeLibraryEntry(raw: RawLibraryEntry): LibraryEntry {
  return {
    status: raw.status,
    // Zero is "unrated" in the column, and reads as no rating rather than as a
    // score of nought.
    userRating: toNumber(raw.user_rating) || null,
    review: raw.review ?? null,
    subjects: raw.subjects ?? [],
    // Both are AI-generated per book and populated lazily, so plenty of rows
    // carry empty arrays — the filters that read them narrow to what is tagged.
    moods: raw.moods ?? [],
    themes: raw.themes ?? [],
    addedAt: raw.date_added ?? null,
    // Absent means false rather than unknown: a row that carries no flags came
    // from a source that has none, and neither flag is optional in the table.
    isFavorite: raw.is_favorite ?? false,
    isHidden: raw.is_hidden ?? false,
    // Null reads as physical, which is also what the columns default to.
    isEbook: raw.is_ebook ?? false,
    isAudiobook: raw.is_audiobook ?? false,
    book: {
      id: raw.book_id,
      slug: raw.book_slug,
      title: raw.title,
      authorName: raw.author_name,
      authorSlug: raw.author_slug,
      year: raw.year,
      coverUrl: raw.cover_url,
      hue: raw.hue,
      rating: toNumber(raw.rating),
      source: 'catalog',
    },
  };
}

// fn_library_stats.sql omits statuses with zero entries; callers need every key present.
export function normalizeLibraryStatusCounts(
  byStatus: Partial<Record<LibraryStatus, number>>,
): Record<LibraryStatus, number> {
  return {
    queued: byStatus.queued ?? 0,
    reading: byStatus.reading ?? 0,
    finished: byStatus.finished ?? 0,
    abandoned: byStatus.abandoned ?? 0,
  };
}
