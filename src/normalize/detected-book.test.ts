import { describe, expect, it } from 'vitest';
import { normalizeDetectedBook, rawFieldsForDetected } from './detected-book';
import type { RawDetectedBook } from '../api/upload/scan';
import type { RawAiSearchBook } from './search';
import type { BookSummary } from '../shared/types/book';

const catalogBook: BookSummary = {
  id: 42,
  slug: 'dune',
  title: 'Dune',
  authorName: 'Frank Herbert',
  authorSlug: 'frank-herbert',
  year: 1965,
  coverUrl: 'https://example.test/dune.jpg',
  hue: '#6f7a55',
  rating: 4.5,
  source: 'catalog',
};

function makeResolved(overrides: Partial<RawAiSearchBook> = {}): RawAiSearchBook {
  return {
    googleBooksId: 'gb-1',
    openLibraryId: null,
    title: 'The Left Hand of Darkness',
    authors: ['Ursula K. Le Guin'],
    year: 1969,
    publisher: 'Ace',
    pages: 304,
    rating: 4.2,
    coverUrl: 'https://example.test/lhod.jpg',
    isbn13: '9780441478125',
    language: 'en',
    blurb: 'Winter world.',
    categories: ['Science Fiction'],
    moods: [],
    inLibrary: false,
    libraryStatus: null,
    source: 'google_books',
    ...overrides,
  };
}

const catalogById = new Map<number, BookSummary>([[42, catalogBook]]);

describe('normalizeDetectedBook', () => {
  it('uses the catalog row for a matched book', () => {
    const raw: RawDetectedBook = { title: 'Dune', author: 'Frank Herbert', matchedBookId: 42 };
    const result = normalizeDetectedBook(raw, catalogById);

    expect(result.tier).toBe('catalog');
    expect(result.slug).toBe('dune');
    expect(result.book).toBe(catalogBook);
    expect(result.key).toBe('book:42');
  });

  it('degrades to unresolved when a matched id has no catalog row', () => {
    const raw: RawDetectedBook = { title: 'Ghost', author: null, matchedBookId: 999 };
    const result = normalizeDetectedBook(raw, catalogById);

    expect(result.tier).toBe('unresolved');
    expect(result.book.title).toBe('Ghost');
    expect(result.book.authorName).toBe('Unknown');
  });

  it('carries provider metadata through for a resolved book', () => {
    const raw: RawDetectedBook = {
      title: 'Left Hand of Darkness',
      author: 'Le Guin',
      resolvedBook: makeResolved(),
    };
    const result = normalizeDetectedBook(raw, catalogById);

    expect(result.tier).toBe('resolved');
    expect(result.slug).toBe('the-left-hand-of-darkness');
    expect(result.book.title).toBe('The Left Hand of Darkness');
    expect(result.book.authorName).toBe('Ursula K. Le Guin');
    expect(result.book.coverUrl).toBe('https://example.test/lhod.jpg');
  });

  it('gives an unresolved spine a stable hue and no cover', () => {
    const raw: RawDetectedBook = { title: 'Unknown Spine', author: 'Someone' };
    const first = normalizeDetectedBook(raw, catalogById);
    const second = normalizeDetectedBook(raw, catalogById);

    expect(first.tier).toBe('unresolved');
    expect(first.book.coverUrl).toBeNull();
    expect(first.book.hue).toBe(second.book.hue);
    expect(first.key).toBe(second.key);
    expect(first.slug).toBe('unknown-spine');
  });

  it('keys unmatched spines by title and author so different books stay distinct', () => {
    const a = normalizeDetectedBook({ title: 'Ubik', author: 'Dick' }, catalogById);
    const b = normalizeDetectedBook({ title: 'Ubik', author: 'Other' }, catalogById);

    expect(a.key).not.toBe(b.key);
  });
});

describe('rawFieldsForDetected', () => {
  it('sends no raw fields for a catalog book, which already has a row', () => {
    const raw: RawDetectedBook = { title: 'Dune', author: 'Frank Herbert', matchedBookId: 42 };
    const detected = normalizeDetectedBook(raw, catalogById);

    expect(rawFieldsForDetected(detected, raw)).toBeUndefined();
  });

  it('maps a resolved book onto the add-to-library upsert shape', () => {
    const raw: RawDetectedBook = { title: 'LHOD', author: 'Le Guin', resolvedBook: makeResolved() };
    const detected = normalizeDetectedBook(raw, catalogById);

    expect(rawFieldsForDetected(detected, raw)).toEqual({
      title: 'The Left Hand of Darkness',
      authorName: 'Ursula K. Le Guin',
      googleBooksId: 'gb-1',
      openLibraryId: null,
      year: 1969,
      publisher: 'Ace',
      pages: 304,
      rating: 4.2,
      subjects: ['Science Fiction'],
      blurb: 'Winter world.',
      coverUrl: 'https://example.test/lhod.jpg',
      isbn13: '9780441478125',
      language: 'en',
    });
  });

  it('joins multiple authors into a single name', () => {
    const raw: RawDetectedBook = {
      title: 'Co-written',
      author: null,
      resolvedBook: makeResolved({ authors: ['Ann Author', 'Bob Writer'] }),
    };
    const detected = normalizeDetectedBook(raw, catalogById);

    expect(rawFieldsForDetected(detected, raw)!.authorName).toBe('Ann Author, Bob Writer');
  });

  it('falls back to title and author only for an unresolved spine', () => {
    const raw: RawDetectedBook = { title: 'Mystery Book', author: 'A. Nonymous' };
    const detected = normalizeDetectedBook(raw, catalogById);

    expect(rawFieldsForDetected(detected, raw)).toEqual({
      title: 'Mystery Book',
      authorName: 'A. Nonymous',
    });
  });
});
