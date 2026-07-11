import { describe, expect, it } from 'vitest';
import { normalizeBooksByIds } from './books-by-ids';

describe('normalizeBooksByIds', () => {
  it('tags each already-camelCase book as catalog-sourced', () => {
    const result = normalizeBooksByIds({
      books: [
        {
          id: 12,
          slug: 'some-book',
          title: 'Some Book',
          authorName: 'A. Author',
          authorSlug: 'a-author',
          year: 2001,
          rating: 4.2,
          coverUrl: null,
          hue: '#815065',
        },
      ],
    });

    expect(result).toEqual([
      {
        id: 12,
        slug: 'some-book',
        title: 'Some Book',
        authorName: 'A. Author',
        authorSlug: 'a-author',
        year: 2001,
        rating: 4.2,
        coverUrl: null,
        hue: '#815065',
        source: 'catalog',
      },
    ]);
  });

  it('returns an empty array for no ids', () => {
    expect(normalizeBooksByIds({ books: [] })).toEqual([]);
  });
});
