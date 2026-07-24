import { describe, expect, it } from 'vitest';
import {
  OTHER_SLICE_LABEL,
  TOP_SLICE_COUNT,
  authorSlices,
  filterEntries,
  sortByAddedDesc,
  statusCounts,
  statusSlices,
  subjectSlices,
} from './breakdowns';
import type { LibraryEntry } from '../../../normalize/library';
import type { LibraryStatus } from '../../../shared/types/library-status';

let nextId = 1;

function makeEntry(overrides: Partial<LibraryEntry> & { status?: LibraryStatus } = {}): LibraryEntry {
  const id = overrides.book?.id ?? nextId++;
  return {
    status: overrides.status ?? 'queued',
    notes: null,
    subjects: overrides.subjects ?? [],
    addedAt: overrides.addedAt ?? null,
    book: {
      id,
      slug: `book-${id}`,
      title: `Book ${id}`,
      authorName: overrides.book?.authorName ?? 'Anon',
      authorSlug: 'anon',
      year: null,
      coverUrl: null,
      hue: '#000',
      rating: null,
      source: 'catalog',
      ...overrides.book,
    },
  };
}

describe('statusCounts', () => {
  it('counts entries by status with zero defaults', () => {
    const entries = [
      makeEntry({ status: 'reading' }),
      makeEntry({ status: 'reading' }),
      makeEntry({ status: 'finished' }),
    ];
    expect(statusCounts(entries)).toEqual({ queued: 0, reading: 2, finished: 1, abandoned: 0 });
  });
});

describe('statusSlices', () => {
  it('omits statuses with no books', () => {
    const slices = statusSlices([makeEntry({ status: 'queued' }), makeEntry({ status: 'queued' })]);
    expect(slices).toHaveLength(1);
    expect(slices[0]).toMatchObject({ label: 'Queued', value: 2 });
  });
});

describe('subjectSlices', () => {
  it('tallies subjects across entries, sorted descending', () => {
    const entries = [
      makeEntry({ subjects: ['Evolution', 'Biology'] }),
      makeEntry({ subjects: ['Evolution'] }),
      makeEntry({ subjects: ['Biology'] }),
      makeEntry({ subjects: ['Evolution'] }),
    ];
    const slices = subjectSlices(entries);
    expect(slices[0]).toEqual({ label: 'Evolution', value: 3 });
    expect(slices).toContainEqual({ label: 'Biology', value: 2 });
  });

  it('collapses the tail past the top N into an Other slice', () => {
    const entries = Array.from({ length: TOP_SLICE_COUNT + 3 }, (_, i) =>
      makeEntry({ subjects: [`Subject ${i}`] }),
    );
    const slices = subjectSlices(entries);
    expect(slices).toHaveLength(TOP_SLICE_COUNT + 1);
    const other = slices.find((slice) => slice.label === OTHER_SLICE_LABEL);
    expect(other?.value).toBe(3);
  });
});

describe('authorSlices', () => {
  it('tallies by author name', () => {
    const slices = authorSlices([
      makeEntry({ book: { authorName: 'Darwin' } as LibraryEntry['book'] }),
      makeEntry({ book: { authorName: 'Darwin' } as LibraryEntry['book'] }),
      makeEntry({ book: { authorName: 'Dawkins' } as LibraryEntry['book'] }),
    ]);
    expect(slices[0]).toEqual({ label: 'Darwin', value: 2 });
  });
});

describe('filterEntries', () => {
  const entries = [
    makeEntry({ status: 'reading', subjects: ['Evolution'], book: { authorName: 'Darwin' } as LibraryEntry['book'] }),
    makeEntry({ status: 'finished', subjects: ['Physics'], book: { authorName: 'Feynman' } as LibraryEntry['book'] }),
    makeEntry({ status: 'reading', subjects: ['Physics'], book: { authorName: 'Darwin' } as LibraryEntry['book'] }),
  ];

  it('filters by status', () => {
    expect(filterEntries(entries, { status: 'reading', subject: null, author: null })).toHaveLength(2);
  });

  it('filters by subject', () => {
    expect(filterEntries(entries, { status: null, subject: 'Physics', author: null })).toHaveLength(2);
  });

  it('combines status and author with AND', () => {
    const result = filterEntries(entries, { status: 'reading', subject: null, author: 'Darwin' });
    expect(result).toHaveLength(2);
  });

  it('returns everything when no filter is set', () => {
    expect(filterEntries(entries, { status: null, subject: null, author: null })).toHaveLength(3);
  });
});

describe('sortByAddedDesc', () => {
  it('sorts by addedAt newest first', () => {
    const older = makeEntry({ addedAt: '2026-01-01T00:00:00Z' });
    const newer = makeEntry({ addedAt: '2026-06-01T00:00:00Z' });
    const sorted = sortByAddedDesc([older, newer]);
    expect(sorted.map((e) => e.addedAt)).toEqual([newer.addedAt, older.addedAt]);
  });

  it('places dated entries before undated ones, and undated by id desc', () => {
    const dated = makeEntry({ addedAt: '2026-01-01T00:00:00Z', book: { id: 1 } as LibraryEntry['book'] });
    const undatedLow = makeEntry({ book: { id: 5 } as LibraryEntry['book'] });
    const undatedHigh = makeEntry({ book: { id: 9 } as LibraryEntry['book'] });
    const sorted = sortByAddedDesc([undatedLow, dated, undatedHigh]);
    expect(sorted.map((e) => e.book.id)).toEqual([1, 9, 5]);
  });
});
