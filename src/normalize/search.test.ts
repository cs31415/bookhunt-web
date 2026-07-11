import { describe, expect, it } from 'vitest';
import { normalizeSearchBook, normalizeSearchResponse } from './search';
import type { RawSearchBook, RawSearchResponse } from './search';

const rawBook: RawSearchBook = {
  book_id: 95,
  slug: 'night-watch',
  title: 'Night Watch',
  author_name: 'Lucille Fletcher',
  author_slug: 'lucille-fletcher',
  year: 2026,
  rating: null,
  cover_url: 'https://covers.example.com/night-watch.jpg',
  hue: '#6f7a55',
  in_library: false,
  library_status: null,
};

describe('normalizeSearchBook', () => {
  it('maps a raw search result to a catalog-sourced BookSummary with no status', () => {
    expect(normalizeSearchBook(rawBook)).toEqual({
      book: {
        id: 95,
        slug: 'night-watch',
        title: 'Night Watch',
        authorName: 'Lucille Fletcher',
        authorSlug: 'lucille-fletcher',
        year: 2026,
        coverUrl: 'https://covers.example.com/night-watch.jpg',
        hue: '#6f7a55',
        rating: null,
        source: 'catalog',
      },
    });
  });

  it('includes status when the caller has the book in their library', () => {
    const result = normalizeSearchBook({ ...rawBook, in_library: true, library_status: 'reading' });
    expect(result.status).toBe('reading');
  });
});

describe('normalizeSearchResponse', () => {
  it('maps books, total, page, pageSize, and query', () => {
    const raw: RawSearchResponse = {
      books: [rawBook],
      total: 66,
      page: 1,
      pageSize: 24,
      query: 'thriller',
    };

    const result = normalizeSearchResponse(raw);

    expect(result.total).toBe(66);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(24);
    expect(result.query).toBe('thriller');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].book.slug).toBe('night-watch');
  });
});
