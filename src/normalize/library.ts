import type { BookSummary } from '../shared/types/book';
import type { LibraryStatus } from '../shared/types/library-status';
import { toNumber } from '../shared/lib/to-number';

export interface RawLibraryEntry {
  book_id: number;
  status: LibraryStatus;
  notes: string | null;
  review: string | null;
  title: string;
  book_slug: string;
  author_name: string;
  author_slug: string;
  year: number | null;
  rating: number | null;
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
}

export interface RawLibraryStats {
  total: number;
  by_status: Partial<Record<LibraryStatus, number>>;
}

export interface LibraryEntry {
  book: BookSummary;
  status: LibraryStatus;
  notes: string | null;
  subjects: string[];
  moods: string[];
  themes: string[];
  addedAt: string | null;
  isFavorite: boolean;
  /** Excluded from the public profile. No effect on this, the owner's own view. */
  isHidden: boolean;
}

export function normalizeLibraryEntry(raw: RawLibraryEntry): LibraryEntry {
  return {
    status: raw.status,
    notes: raw.notes ?? raw.review ?? null,
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
