import type { BookSummary } from '../shared/types/book';
import type { LibraryStatus } from '../shared/types/library-status';

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
}

export interface RawLibraryStats {
  total: number;
  by_status: Partial<Record<LibraryStatus, number>>;
}

export interface LibraryEntry {
  book: BookSummary;
  status: LibraryStatus;
  notes: string | null;
}

export function normalizeLibraryEntry(raw: RawLibraryEntry): LibraryEntry {
  return {
    status: raw.status,
    notes: raw.notes ?? raw.review ?? null,
    book: {
      id: raw.book_id,
      slug: raw.book_slug,
      title: raw.title,
      authorName: raw.author_name,
      authorSlug: raw.author_slug,
      year: raw.year,
      coverUrl: raw.cover_url,
      hue: raw.hue,
      rating: raw.rating,
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
