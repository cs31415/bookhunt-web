import { describe, expect, it } from 'vitest';
import { normalizeAiSearchBook, normalizeAiSearchResponse } from './search';
import type { RawAiSearchBook, RawAiSearchResponse } from './search';

const rawBook: RawAiSearchBook = {
  googleBooksId: 'abc123',
  openLibraryId: null,
  title: 'Night Watch',
  authors: ['Lucille Fletcher'],
  year: 2026,
  publisher: 'Dramatists Play Service Inc',
  pages: 80,
  rating: 4.2,
  coverUrl: 'https://covers.example.com/night-watch.jpg',
  isbn13: '9780822208266',
  language: 'en',
  blurb: 'An outstanding Broadway success…',
  categories: ['Drama'],
  inLibrary: false,
  libraryStatus: null,
  source: 'google_books',
};

describe('normalizeAiSearchBook', () => {
  it('maps a Google Books result to a google_books-sourced BookSummary with no status', () => {
    const result = normalizeAiSearchBook(rawBook);

    expect(result.book).toMatchObject({
      title: 'Night Watch',
      authorName: 'Lucille Fletcher',
      year: 2026,
      coverUrl: 'https://covers.example.com/night-watch.jpg',
      rating: 4.2,
      source: 'google_books',
    });
    expect(result.status).toBeUndefined();
    expect(result.googleBooksId).toBe('abc123');
    expect(result.categories).toEqual(['Drama']);
  });

  it('derives a stable id/hue from the same seed across calls', () => {
    const a = normalizeAiSearchBook(rawBook);
    const b = normalizeAiSearchBook(rawBook);
    expect(a.book.id).toBe(b.book.id);
    expect(a.book.hue).toBe(b.book.hue);
  });

  it('includes status when the caller has the book in their library', () => {
    const result = normalizeAiSearchBook({ ...rawBook, inLibrary: true, libraryStatus: 'reading' });
    expect(result.status).toBe('reading');
  });

  it('sources from open_library when there is an openLibraryId but no googleBooksId', () => {
    const result = normalizeAiSearchBook({ ...rawBook, googleBooksId: null, openLibraryId: 'OL123M' });
    expect(result.book.source).toBe('open_library');
    expect(result.openLibraryId).toBe('OL123M');
  });

  it('joins multiple authors', () => {
    const result = normalizeAiSearchBook({ ...rawBook, authors: ['A', 'B'] });
    expect(result.book.authorName).toBe('A, B');
  });

  it('falls back to "Unknown" when there are no authors', () => {
    const result = normalizeAiSearchBook({ ...rawBook, authors: [] });
    expect(result.book.authorName).toBe('Unknown');
  });
});

describe('normalizeAiSearchResponse', () => {
  it('maps books and query', () => {
    const raw: RawAiSearchResponse = {
      books: [rawBook],
      query: 'thriller',
    };

    const result = normalizeAiSearchResponse(raw);

    expect(result.query).toBe('thriller');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].book.title).toBe('Night Watch');
  });
});
