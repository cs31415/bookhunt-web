import type { BookSummary } from '../shared/types/book';
import type { RawDetectedBook } from '../api/upload/scan';
import type { AddToLibraryRawFields } from '../api/library/add-to-library';
import { hashToHue, hashToId } from '../shared/lib/hash';
import { slugify } from '../shared/lib/slugify';
import { normalizeAiSearchBook } from './search';

/**
 * How well the scan pinned a detected spine down. Drives the cover shown, whether
 * the row starts ticked, and which add-to-library call it needs.
 */
export type DetectionTier = 'catalog' | 'resolved' | 'unresolved';

export interface DetectedBook {
  /** Stable identity for React keys and the selection map. */
  key: string;
  tier: DetectionTier;
  book: BookSummary;
  /** Catalog slug — present for 'catalog', derived from the title otherwise. */
  slug: string;
}

function detectionKey(raw: RawDetectedBook): string {
  if (raw.matchedBookId !== undefined) return `book:${raw.matchedBookId}`;
  return `spine:${raw.title.toLowerCase()}||${raw.author ?? ''}`;
}

/**
 * Turns one raw detection into a renderable row. Tier 1 needs its catalog row
 * supplied by the caller (a single GET /books?ids= covers the whole batch); a
 * matchedBookId with no catalog row degrades to 'unresolved' rather than
 * rendering a blank card.
 */
export function normalizeDetectedBook(
  raw: RawDetectedBook,
  catalogById: Map<number, BookSummary>,
): DetectedBook {
  const key = detectionKey(raw);

  if (raw.matchedBookId !== undefined) {
    const book = catalogById.get(raw.matchedBookId);
    if (book) return { key, tier: 'catalog', book, slug: book.slug };
  }

  if (raw.resolvedBook) {
    const { book } = normalizeAiSearchBook(raw.resolvedBook);
    return { key, tier: 'resolved', book, slug: slugify(raw.resolvedBook.title) };
  }

  const authorName = raw.author ?? 'Unknown';
  const seed = `${raw.title}|${authorName}`;
  return {
    key,
    tier: 'unresolved',
    slug: slugify(raw.title),
    book: {
      id: hashToId(seed),
      slug: '',
      title: raw.title,
      authorName,
      authorSlug: '',
      year: null,
      coverUrl: null,
      hue: hashToHue(seed),
      rating: null,
      source: 'catalog',
    },
  };
}

/**
 * Catalog fields for POST /library/:slug. Tier 1 books already have a catalog
 * row, so they pass no rawFields at all — only the other two tiers upsert.
 */
export function rawFieldsForDetected(
  detected: DetectedBook,
  raw: RawDetectedBook,
): AddToLibraryRawFields | undefined {
  if (detected.tier === 'catalog') return undefined;

  const resolved = raw.resolvedBook;
  if (!resolved) {
    return { title: detected.book.title, authorName: detected.book.authorName };
  }

  return {
    title: resolved.title,
    authorName: resolved.authors.join(', ') || 'Unknown',
    googleBooksId: resolved.googleBooksId,
    openLibraryId: resolved.openLibraryId,
    year: resolved.year,
    publisher: resolved.publisher,
    pages: resolved.pages,
    rating: resolved.rating,
    subjects: resolved.categories,
    blurb: resolved.blurb,
    coverUrl: resolved.coverUrl,
    isbn13: resolved.isbn13,
    language: resolved.language,
  };
}
