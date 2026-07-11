import { describe, expect, it } from 'vitest';
import { normalizeBookDetail } from './book-detail';
import type { RawGetBookResponse } from './book-detail';

const rawBook: RawGetBookResponse['book'] = {
  id: 95,
  slug: 'night-watch',
  title: 'Night Watch',
  author_id: 96,
  year: 2026,
  publisher: 'Dramatists Play Service Inc',
  pages: 80,
  rating: null,
  subjects: [],
  moods: [],
  genres: [],
  themes: [],
  hue: '#6f7a55',
  blurb: 'An outstanding Broadway success…',
  cover_url: 'https://covers.example.com/night-watch.jpg',
  google_books_id: 'iD_Pg6P6gt0C',
  isbn13: '9780822208266',
  language: 'en',
  related: [12, 34],
  author_name: 'Lucille Fletcher',
  author_slug: 'lucille-fletcher',
};

describe('normalizeBookDetail', () => {
  it('maps the raw snake_case book to a camelCase BookDetail with no libraryEntry when not in library', () => {
    const result = normalizeBookDetail({ book: rawBook, inLibrary: false });

    expect(result.inLibrary).toBe(false);
    expect(result.libraryEntry).toBeUndefined();
    expect(result.book).toEqual({
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
      publisher: 'Dramatists Play Service Inc',
      pages: 80,
      subjects: [],
      moods: [],
      genres: [],
      themes: [],
      blurb: 'An outstanding Broadway success…',
      googleBooksId: 'iD_Pg6P6gt0C',
      isbn13: '9780822208266',
      language: 'en',
      relatedIds: [12, 34],
    });
  });

  it('maps the raw libraryEntry when the book is in the library', () => {
    const result = normalizeBookDetail({
      book: rawBook,
      inLibrary: true,
      libraryEntry: {
        status: 'reading',
        user_rating: 4,
        notes: 'Gripping',
        review: null,
        user_related: [1, 2, 3],
      },
    });

    expect(result.libraryEntry).toEqual({
      status: 'reading',
      userRating: 4,
      notes: 'Gripping',
      userRelatedIds: [1, 2, 3],
    });
  });
});
