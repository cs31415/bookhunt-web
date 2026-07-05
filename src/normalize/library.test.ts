import { describe, expect, it } from 'vitest';
import { normalizeLibraryEntry, normalizeLibraryStatusCounts } from './library';
import type { RawLibraryEntry } from './library';

const rawEntry: RawLibraryEntry = {
  book_id: 1,
  status: 'reading',
  notes: 'Slow start but picking up',
  review: null,
  title: 'Dune',
  book_slug: 'dune',
  author_name: 'Frank Herbert',
  author_slug: 'frank-herbert',
  year: 1965,
  rating: 4.5,
  cover_url: 'https://covers.example.com/dune.jpg',
  hue: '#6f7a55',
};

describe('normalizeLibraryEntry', () => {
  it('maps snake_case fields to a BookSummary + status + notes', () => {
    expect(normalizeLibraryEntry(rawEntry)).toEqual({
      status: 'reading',
      notes: 'Slow start but picking up',
      book: {
        id: 1,
        slug: 'dune',
        title: 'Dune',
        authorName: 'Frank Herbert',
        authorSlug: 'frank-herbert',
        year: 1965,
        coverUrl: 'https://covers.example.com/dune.jpg',
        hue: '#6f7a55',
        rating: 4.5,
        source: 'catalog',
      },
    });
  });

  it('falls back to review when notes is null', () => {
    const entry = normalizeLibraryEntry({ ...rawEntry, notes: null, review: 'A classic' });
    expect(entry.notes).toBe('A classic');
  });

  it('returns null notes when neither notes nor review is set', () => {
    const entry = normalizeLibraryEntry({ ...rawEntry, notes: null, review: null });
    expect(entry.notes).toBeNull();
  });
});

describe('normalizeLibraryStatusCounts', () => {
  it('defaults missing statuses to 0', () => {
    expect(normalizeLibraryStatusCounts({ reading: 3, finished: 9 })).toEqual({
      queued: 0,
      reading: 3,
      finished: 9,
      abandoned: 0,
    });
  });

  it('returns all zeros for an empty library', () => {
    expect(normalizeLibraryStatusCounts({})).toEqual({
      queued: 0,
      reading: 0,
      finished: 0,
      abandoned: 0,
    });
  });
});
