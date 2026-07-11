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
      // External work: no bookId/slug — should be filtered out (LOS-83 territory).
      title: 'Sorry, Wrong Number, and The Hitch-hiker',
      year: 1974,
      rating: null,
      coverUrl: null,
      inLibrary: false,
      libraryStatus: null,
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

  it('filters out non-catalog works (no bookId/slug)', () => {
    const result = normalizeAuthor(raw);
    expect(result.catalogWorks).toHaveLength(1);
    expect(result.catalogWorks[0].book.slug).toBe('night-watch');
  });

  it('attaches the author name/slug to each catalog work and a default hue', () => {
    const result = normalizeAuthor(raw);
    expect(result.catalogWorks[0].book).toMatchObject({
      authorName: 'Lucille Fletcher',
      authorSlug: 'lucille-fletcher',
      hue: '#6f7a55',
    });
  });

  it('includes status only when the work is in the library', () => {
    const inLib = normalizeAuthor({
      ...raw,
      books: [{ ...raw.books[0], inLibrary: true, libraryStatus: 'reading' }],
    });
    expect(inLib.catalogWorks[0].status).toBe('reading');

    const notInLib = normalizeAuthor(raw);
    expect(notInLib.catalogWorks[0].status).toBeUndefined();
  });
});
