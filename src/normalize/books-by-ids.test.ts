import { describe, expect, it } from 'vitest';
import { normalizeBooksByIds, normalizeBooksByGoogleIds } from './books-by-ids';

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

describe('normalizeBooksByGoogleIds', () => {
  it('maps googleBooksId to catalog slug', () => {
    const result = normalizeBooksByGoogleIds({
      books: [
        {
          id: 4,
          slug: 'india-unbound',
          title: 'India Unbound',
          authorName: 'Gurcharan Das',
          authorSlug: 'gurcharan-das',
          year: 2001,
          rating: null,
          coverUrl: null,
          hue: '#6f7a55',
          googleBooksId: 'ntDsAAAAMAAJ',
        },
      ],
    });

    expect(result.get('ntDsAAAAMAAJ')).toBe('india-unbound');
    expect(result.get('unknown-id')).toBeUndefined();
  });

  it('returns an empty map for no matches', () => {
    expect(normalizeBooksByGoogleIds({ books: [] }).size).toBe(0);
  });
});
