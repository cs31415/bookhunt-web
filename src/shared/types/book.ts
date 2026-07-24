export type BookSource = 'catalog' | 'google_books' | 'open_library';

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
  googleBooksId?: string | null;
  openLibraryId?: string | null;
}
