export type BookSource = 'catalog' | 'google_books';

export interface BookSummary {
  id: number;
  slug: string;
  title: string;
  authorName: string;
  authorSlug: string;
  year: number | null;
  coverUrl: string | null;
  hue: string;
  rating: number | null;
  source: BookSource;
}
