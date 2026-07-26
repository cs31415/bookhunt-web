import { describe, expect, it } from 'vitest';
import { normalizeAuthor } from './author';
import type { RawGetAuthorResponse } from './author';

const raw: RawGetAuthorResponse = {
  author: {
    id: 96,
    slug: 'lucille-fletcher',
    name: 'Lucille Fletcher',
    birth_year: 1912,
    country: 'United States',
    bio: 'An American screenwriter and novelist…',
  },
  books: [
    {
      bookId: 95,
      slug: 'night-watch',
      title: 'Night Watch',
      year: 2026,
      rating: null,
      coverUrl: 'https://covers.example.com/night-watch.jpg',
      inLibrary: false,
      libraryStatus: null,
    },
    {
      // Provider work: no bookId/slug, resolved server-side from a provider.
      title: 'Sorry, Wrong Number, and The Hitch-hiker',
      year: 1974,
      rating: null,
      coverUrl: null,
      inLibrary: false,
      libraryStatus: null,
      googleBooksId: 'gb-xyz',
      openLibraryId: null,
    },
  ],
};

describe('normalizeAuthor', () => {
  it('maps the raw snake_case author fields to camelCase', () => {
    const result = normalizeAuthor(raw);
    expect(result.author).toEqual({
      id: 96,
      slug: 'lucille-fletcher',
      name: 'Lucille Fletcher',
      birthYear: 1912,
      country: 'United States',
      bio: 'An American screenwriter and novelist…',
    });
  });

  it('keeps both catalog and provider works (provider-agnostic)', () => {
    const result = normalizeAuthor(raw);
    expect(result.works).toHaveLength(2);
    expect(result.works[0].book.slug).toBe('night-watch');
    expect(result.works[0].book.source).toBe('catalog');
  });

  it('normalizes a provider work with a derived slug, source and provider id', () => {
    const providerWork = normalizeAuthor(raw).works[1];
    expect(providerWork.book.slug).toBe('sorry-wrong-number-and-the-hitch-hiker');
    expect(providerWork.book.source).toBe('google_books');
    expect(providerWork.book.googleBooksId).toBe('gb-xyz');
    // A provider work gets a stable pseudo-id and hue rather than a catalog one.
    expect(typeof providerWork.book.id).toBe('number');
    expect(providerWork.book.hue).toMatch(/^hsl\(/);
  });

  it('attaches the author name/slug to each catalog work and a default hue', () => {
    const result = normalizeAuthor(raw);
    expect(result.works[0].book).toMatchObject({
      authorName: 'Lucille Fletcher',
      authorSlug: 'lucille-fletcher',
      hue: '#6f7a55',
    });
  });

  it('coerces a string rating (Postgres NUMERIC) to a number so BookCard can format it', () => {
    // The API serializes NUMERIC ratings as strings ("4.5"); a raw pass-through
    // makes BookCard's rating.toFixed(1) throw and crashes the Author page.
    const result = normalizeAuthor({
      ...raw,
      books: [{ ...raw.books[0], rating: '4.5' as unknown as number }],
    });
    expect(result.works[0].book.rating).toBe(4.5);
    expect(typeof result.works[0].book.rating).toBe('number');
  });

  it('includes status only when the work is in the library', () => {
    const inLib = normalizeAuthor({
      ...raw,
      books: [{ ...raw.books[0], inLibrary: true, libraryStatus: 'reading' }],
    });
    expect(inLib.works[0].status).toBe('reading');

    const notInLib = normalizeAuthor(raw);
    expect(notInLib.works[0].status).toBeUndefined();
  });
});
