import type { BookSummary } from '../types/book';
import { slugify } from './slugify';

/**
 * Builds the Book Detail href for any book, provider-agnostic. Book Detail
 * resolves by slug first, falling back to a live lookup by title/author when
 * the book isn't cataloged yet (LOS-127/128). The resolved provider id (when
 * known) rides along as `pid` so Book Detail fetches the exact same edition
 * instead of re-searching by text and possibly landing on a different one
 * (LOS-135). Provider is opaque here — `g:` for Google Books, `o:` for
 * OpenLibrary — nothing is special-cased to a single provider.
 */
export function buildBookHref(book: BookSummary, options: { handle?: string } = {}): string {
  const bookSlug = book.slug || slugify(book.title);
  const authorSlug = book.authorSlug || slugify(book.authorName);
  const params = new URLSearchParams({ a: authorSlug });
  const pid = book.googleBooksId
    ? `g:${book.googleBooksId}`
    : book.openLibraryId
      ? `o:${book.openLibraryId}`
      : null;
  if (pid) params.set('pid', pid);
  // Whose copy of the book to show (LOS-360). A third hint of the same kind as
  // the two above rather than a path of its own: this is the same book,
  // resolved with more context, not a different resource.
  if (options.handle) params.set('u', options.handle);
  return `/books/${bookSlug}?${params.toString()}`;
}
