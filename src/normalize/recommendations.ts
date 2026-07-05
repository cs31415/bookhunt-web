import type { BookSummary } from '../shared/types/book';

export interface RawRecommendation {
  book: {
    id: number;
    slug: string;
    title: string;
    authorName: string;
    authorSlug: string;
    year: number | null;
    rating: number | null;
    coverUrl: string | null;
    hue: string;
  };
  reason: string;
}

export interface Recommendation {
  book: BookSummary;
  reason: string;
}

export function normalizeRecommendation(raw: RawRecommendation): Recommendation {
  return {
    reason: raw.reason,
    book: {
      id: raw.book.id,
      slug: raw.book.slug,
      title: raw.book.title,
      authorName: raw.book.authorName,
      authorSlug: raw.book.authorSlug,
      year: raw.book.year,
      coverUrl: raw.book.coverUrl,
      hue: raw.book.hue,
      rating: raw.book.rating,
      source: 'catalog',
    },
  };
}
