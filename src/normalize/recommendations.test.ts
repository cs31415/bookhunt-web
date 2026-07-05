import { describe, expect, it } from 'vitest';
import { normalizeRecommendation } from './recommendations';
import type { RawRecommendation } from './recommendations';

describe('normalizeRecommendation', () => {
  it('maps a raw recommendation to a Recommendation with a catalog-sourced BookSummary', () => {
    const raw: RawRecommendation = {
      reason: 'More from Herbert',
      book: {
        id: 2,
        slug: 'the-left-hand-of-darkness',
        title: 'The Left Hand of Darkness',
        authorName: 'Ursula K. Le Guin',
        authorSlug: 'ursula-k-le-guin',
        year: 1969,
        rating: 4,
        coverUrl: null,
        hue: '#4a6670',
      },
    };

    expect(normalizeRecommendation(raw)).toEqual({
      reason: 'More from Herbert',
      book: {
        id: 2,
        slug: 'the-left-hand-of-darkness',
        title: 'The Left Hand of Darkness',
        authorName: 'Ursula K. Le Guin',
        authorSlug: 'ursula-k-le-guin',
        year: 1969,
        coverUrl: null,
        hue: '#4a6670',
        rating: 4,
        source: 'catalog',
      },
    });
  });
});
