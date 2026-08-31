import { describe, expect, it } from 'vitest';
import { normalizeLibraryEntry, normalizeLibraryStatusCounts } from './library';
import type { RawLibraryEntry } from './library';

const rawEntry: RawLibraryEntry = {
  book_id: 1,
  status: 'reading',
  review: 'Slow start but picking up',
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
  it('keeps the reader\'s own rating apart from the catalog\'s', () => {
    // fn_get_user_library returns both; the shelf shows both (LOS-291).
    expect(normalizeLibraryEntry({ ...rawEntry, rating: 4.2, user_rating: 5 })).toMatchObject({
      userRating: 5,
      book: expect.objectContaining({ rating: 4.2 }),
    });
  });

  it('reads an unrated zero as no rating at all', () => {
    // The column stores 0 for "not rated", which is not a score of nought.
    expect(normalizeLibraryEntry({ ...rawEntry, user_rating: 0 })).toMatchObject({
      userRating: null,
    });
  });

  it('maps snake_case fields to a BookSummary + status + review', () => {
    expect(normalizeLibraryEntry(rawEntry)).toEqual({
      status: 'reading',
      review: 'Slow start but picking up',
      shareReview: null,
      subjects: [],
      moods: [],
      themes: [],
      addedAt: null,
      // A raw row carrying no flags came from a source that has none, so absent
      // reads as false rather than unknown.
      isFavorite: false,
      isHidden: false,
      isEbook: false,
      isAudiobook: false,
      // Absent for the same reason: no library row, no score of the reader's.
      userRating: null,
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

  /*
   * There used to be a `raw.notes ?? raw.review` fallback here, and two tests
   * for it. LOS-266 removed it along with the second column: `review` was
   * plumbed end to end and never written by anything, so the fallback had never
   * once fired, and the field a reader actually writes now carries that name.
   */
  it('carries the review through', () => {
    const entry = normalizeLibraryEntry({ ...rawEntry, review: 'A classic' });
    expect(entry.review).toBe('A classic');
  });

  it('returns a null review when the row has none', () => {
    const entry = normalizeLibraryEntry({ ...rawEntry, review: null });
    expect(entry.review).toBeNull();
  });

  it('maps subjects and date_added when present', () => {
    const entry = normalizeLibraryEntry({
      ...rawEntry,
      subjects: ['Science Fiction', 'Politics'],
      date_added: '2026-07-01T00:00:00Z',
    });
    expect(entry.subjects).toEqual(['Science Fiction', 'Politics']);
    expect(entry.addedAt).toBe('2026-07-01T00:00:00Z');
  });

  it('defaults subjects to [] and addedAt to null when absent', () => {
    const entry = normalizeLibraryEntry(rawEntry);
    expect(entry.subjects).toEqual([]);
    expect(entry.addedAt).toBeNull();
  });

  it('carries the library flags through when the row has them', () => {
    const raw = { ...rawEntry, is_favorite: true, is_hidden: true, is_ebook: true };
    expect(normalizeLibraryEntry(raw)).toMatchObject({
      isFavorite: true,
      isHidden: true,
      isEbook: true,
    });
  });

  // Null is what a source with no flags sends, and a book with no recorded
  // format is a physical one.
  it('reads a null or absent ebook flag as a physical book', () => {
    expect(normalizeLibraryEntry(rawEntry).isEbook).toBe(false);
    expect(normalizeLibraryEntry({ ...rawEntry, is_ebook: null }).isEbook).toBe(false);
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
