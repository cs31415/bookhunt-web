import { describe, expect, it } from 'vitest';
import {
  filterEntries,
  sortByShelf,
  statusCounts,
  topCategories,
  topMoods,
  topThemes,
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
    isFavorite: overrides.isFavorite ?? false,
    isHidden: false,
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




describe('filterEntries', () => {
  it('narrows to favourites', () => {
    const entries = [
      makeEntry({ isFavorite: true }),
      makeEntry(),
      makeEntry({ isFavorite: true }),
    ];
    expect(filterEntries(entries, { status: null, category: null, favorite: true })).toHaveLength(2);
  });

  it('composes with the other filters rather than replacing them', () => {
    // The reason favourites is a filter and not a separate view.
    const entries = [
      makeEntry({ isFavorite: true, status: 'reading' }),
      makeEntry({ isFavorite: true, status: 'finished' }),
      makeEntry({ status: 'reading' }),
    ];
    const result = filterEntries(entries, {
      status: 'reading',
      category: null,
      favorite: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].isFavorite).toBe(true);
    expect(result[0].status).toBe('reading');
  });

  const entries = [
    makeEntry({ status: 'reading', subjects: ['Evolution'], book: { authorName: 'Darwin' } as LibraryEntry['book'] }),
    makeEntry({ status: 'finished', subjects: ['Physics'], book: { authorName: 'Feynman' } as LibraryEntry['book'] }),
    makeEntry({ status: 'reading', subjects: ['Physics'], book: { authorName: 'Darwin' } as LibraryEntry['book'] }),
  ];

  it('filters by status', () => {
    expect(filterEntries(entries, { status: 'reading', category: null })).toHaveLength(2);
  });

  it('filters by category', () => {
    expect(filterEntries(entries, { status: null, category: 'Physics' })).toHaveLength(2);
  });

  it('combines status and category with AND', () => {
    const result = filterEntries(entries, { status: 'reading', category: 'Physics' });
    expect(result).toHaveLength(1);
  });

  it('returns everything when no filter is set', () => {
    expect(filterEntries(entries, { status: null, category: null })).toHaveLength(3);
  });

  describe('free-text query', () => {
    const base = { status: null, category: null };
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
    const base = { status: null, category: null };
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


// Categories are read off `subjects`, which holds provider tags and generated
// ones together. Nothing marks which is which — the count threshold separates
// them, and these two tests are that claim.
describe('topCategories', () => {
  it('surfaces a category several books share', () => {
    const entries = [
      makeEntry({ subjects: ['Popular Science', 'Cosmology -- Popular works'] }),
      makeEntry({ subjects: ['Popular Science', 'Astronomy -- History'] }),
    ];

    expect(topCategories(entries)).toEqual(['Popular Science']);
  });

  it('culls the provider long tail without needing to know it is provider data', () => {
    // One book carrying a heap of granular headings, the shape that made the
    // old subject pie 92% "Other".
    const entries = [
      makeEntry({ subjects: ['Fiction', 'Mississippi River -- Fiction', 'Boys -- Fiction', 'Rafting'] }),
      makeEntry({ subjects: ['Fiction'] }),
    ];

    expect(topCategories(entries)).toEqual(['Fiction']);
  });
});

describe('topMoods', () => {
  it('orders by count and drops moods held by one book', () => {
    const entries = [
      makeEntry({ moods: ['Reflective', 'Bleak'] }),
      makeEntry({ moods: ['Reflective', 'Tender'] }),
      makeEntry({ moods: ['Tender'] }),
    ];

    expect(topMoods(entries)).toEqual(['Reflective', 'Tender']);
  });
});

describe('topThemes', () => {
  it('orders by count then alphabetically, and caps the list', () => {
    const entries = [
      makeEntry({ themes: ['Identity', 'Memory', 'Grief'] }),
      makeEntry({ themes: ['Identity', 'Memory', 'Grief'] }),
      makeEntry({ themes: ['Identity', 'Memory'] }),
      makeEntry({ themes: ['Identity'] }),
    ];

    expect(topThemes(entries, 10)).toEqual(['Identity', 'Memory', 'Grief']);
    expect(topThemes(entries, 2)).toEqual(['Identity', 'Memory']);
  });

  it('drops a theme held by a single book, which is a link and not a filter', () => {
    const entries = [
      makeEntry({ themes: ['Identity', 'Memory'] }),
      makeEntry({ themes: ['Identity', 'Grief'] }),
    ];

    expect(topThemes(entries, 10)).toEqual(['Identity']);
  });

  it('is empty when no theme is shared by two books', () => {
    const entries = [makeEntry({ themes: ['Memory'] }), makeEntry({ themes: ['Grief'] })];

    expect(topThemes(entries, 10)).toEqual([]);
  });

  it('is empty when nothing has been tagged yet', () => {
    expect(topThemes([makeEntry()], 10)).toEqual([]);
  });
});

describe('sortByShelf', () => {
  it('orders the shelves Reading, New, Finished, Abandoned', () => {
    const entries = [
      makeEntry({ status: 'abandoned' }),
      makeEntry({ status: 'finished' }),
      makeEntry({ status: 'queued' }),
      makeEntry({ status: 'reading' }),
    ];

    expect(sortByShelf(entries).map((e) => e.status)).toEqual([
      'reading',
      'queued',
      'finished',
      'abandoned',
    ]);
  });

  // Shelf is the outer key: a book added years ago still leads if it's the one
  // being read now.
  it('puts an older Reading book ahead of a newer New one', () => {
    const oldReading = makeEntry({ status: 'reading', addedAt: '2020-01-01T00:00:00Z' });
    const newQueued = makeEntry({ status: 'queued', addedAt: '2026-06-01T00:00:00Z' });

    expect(sortByShelf([newQueued, oldReading]).map((e) => e.status)).toEqual([
      'reading',
      'queued',
    ]);
  });

  it('sorts by addedAt newest first', () => {
    const older = makeEntry({ addedAt: '2026-01-01T00:00:00Z' });
    const newer = makeEntry({ addedAt: '2026-06-01T00:00:00Z' });
    const sorted = sortByShelf([older, newer]);
    expect(sorted.map((e) => e.addedAt)).toEqual([newer.addedAt, older.addedAt]);
  });

  it('places dated entries before undated ones, and undated by id desc', () => {
    const dated = makeEntry({ addedAt: '2026-01-01T00:00:00Z', book: { id: 1 } as LibraryEntry['book'] });
    const undatedLow = makeEntry({ book: { id: 5 } as LibraryEntry['book'] });
    const undatedHigh = makeEntry({ book: { id: 9 } as LibraryEntry['book'] });
    const sorted = sortByShelf([undatedLow, dated, undatedHigh]);
    expect(sorted.map((e) => e.book.id)).toEqual([1, 9, 5]);
  });
});
