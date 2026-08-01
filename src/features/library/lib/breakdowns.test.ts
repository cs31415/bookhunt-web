import { describe, expect, it } from 'vitest';
import {
  OTHER_SLICE_LABEL,
  TOP_SLICE_COUNT,
  authorSlices,
  filterEntries,
  moodSlices,
  topThemes,
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
    moods: overrides.moods ?? [],
    themes: overrides.themes ?? [],
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
    expect(slices[0]).toMatchObject({ label: 'New', value: 2 });
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

  describe('free-text query', () => {
    const base = { status: null, subject: null, author: null };
    const sagan = makeEntry({
      subjects: ['Astronomy'],
      book: { title: 'Cosmos', authorName: 'Carl Sagan' } as LibraryEntry['book'],
    });
    const feynman = makeEntry({
      subjects: ['Physics'],
      book: { title: 'Surely You Are Joking', authorName: 'Richard Feynman' } as LibraryEntry['book'],
    });
    const shelf = [sagan, feynman];

    // The whole point of the ticket: an author surname finds that author's books.
    it('matches on author name', () => {
      expect(filterEntries(shelf, { ...base, q: 'sagan' })).toEqual([sagan]);
    });

    it('matches on title and on subject', () => {
      expect(filterEntries(shelf, { ...base, q: 'cosmos' })).toEqual([sagan]);
      expect(filterEntries(shelf, { ...base, q: 'physics' })).toEqual([feynman]);
    });

    it('is case-insensitive and ignores surrounding whitespace', () => {
      expect(filterEntries(shelf, { ...base, q: '  CARL sagan  ' })).toEqual([sagan]);
    });

    // Each word narrows rather than widens, so a second term is a refinement.
    it('requires every term to match', () => {
      expect(filterEntries(shelf, { ...base, q: 'sagan cosmos' })).toEqual([sagan]);
      expect(filterEntries(shelf, { ...base, q: 'sagan physics' })).toEqual([]);
    });

    it('combines with the other filters', () => {
      expect(filterEntries(shelf, { ...base, status: 'finished', q: 'sagan' })).toEqual([]);
    });

    it('is a no-op when empty or absent', () => {
      expect(filterEntries(shelf, { ...base, q: '' })).toHaveLength(2);
      expect(filterEntries(shelf, base)).toHaveLength(2);
    });

    it('matches on moods and themes too', () => {
      const tagged = makeEntry({ moods: ['Mind-expanding'], themes: ['Scientific discovery'] });
      const untagged = makeEntry();

      expect(filterEntries([tagged, untagged], { ...base, q: 'mind-expanding' })).toEqual([tagged]);
      expect(filterEntries([tagged, untagged], { ...base, q: 'scientific' })).toEqual([tagged]);
    });
  });

  describe('mood and theme (LOS-186)', () => {
    const base = { status: null, subject: null, author: null };
    const reflective = makeEntry({
      moods: ['Reflective', 'Analytical'],
      themes: ['Scientific discovery'],
    });
    const intense = makeEntry({ moods: ['Intense'], themes: ['Totalitarianism'] });
    // AI tags are filled in lazily, so plenty of rows carry neither.
    const untagged = makeEntry();
    const shelf = [reflective, intense, untagged];

    it('filters by mood', () => {
      expect(filterEntries(shelf, { ...base, mood: 'Reflective' })).toEqual([reflective]);
    });

    it('filters by theme', () => {
      expect(filterEntries(shelf, { ...base, theme: 'Totalitarianism' })).toEqual([intense]);
    });

    it('excludes untagged books rather than passing them through', () => {
      expect(filterEntries(shelf, { ...base, mood: 'Reflective' })).not.toContain(untagged);
      expect(filterEntries(shelf, { ...base, theme: 'Totalitarianism' })).not.toContain(untagged);
    });

    it('combines with status', () => {
      expect(filterEntries(shelf, { ...base, status: 'finished', mood: 'Reflective' })).toEqual([]);
    });
  });
});

describe('moodSlices', () => {
  it('tallies moods across entries, most common first', () => {
    const entries = [
      makeEntry({ moods: ['Reflective', 'Analytical'] }),
      makeEntry({ moods: ['Reflective'] }),
      makeEntry({ moods: [] }),
    ];

    expect(moodSlices(entries)).toEqual([
      { label: 'Reflective', value: 2 },
      { label: 'Analytical', value: 1 },
    ]);
  });

  it('is empty when nothing has been tagged yet', () => {
    expect(moodSlices([makeEntry(), makeEntry()])).toEqual([]);
  });
});

describe('topThemes', () => {
  it('orders by count then alphabetically, and caps the list', () => {
    const entries = [
      makeEntry({ themes: ['Identity', 'Memory'] }),
      makeEntry({ themes: ['Identity', 'Grief'] }),
    ];

    expect(topThemes(entries, 10)).toEqual(['Identity', 'Grief', 'Memory']);
    expect(topThemes(entries, 2)).toEqual(['Identity', 'Grief']);
  });

  it('is empty when nothing has been tagged yet', () => {
    expect(topThemes([makeEntry()], 10)).toEqual([]);
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
