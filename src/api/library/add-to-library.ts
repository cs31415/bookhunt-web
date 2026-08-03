import { apiFetch } from '../client';
import type { LibraryStatus } from '../../shared/types/library-status';

export interface AddToLibraryRawFields {
  title: string;
  authorName: string;
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  year?: number | null;
  publisher?: string | null;
  pages?: number | null;
  rating?: number | null;
  subjects?: string[];
  blurb?: string | null;
  coverUrl?: string | null;
  isbn13?: string | null;
  language?: string | null;
}

export interface AddToLibraryResponse {
  entry: unknown;
  book: { id: number; slug: string };
}

/**
 * Uses POST /library/:slug (LOS-127): adds an existing catalog book directly
 * (idempotent, no upsert) when slug matches one, or upserts a new catalog row
 * from rawFields when it doesn't — the only place a not-yet-cataloged book's
 * catalog row gets created, distinct from just viewing it.
 */
export function addToLibrary(
  slug: string,
  status: LibraryStatus = 'queued',
  rawFields?: AddToLibraryRawFields,
  options?: AddToLibraryOptions,
): Promise<AddToLibraryResponse> {
  return apiFetch(`/library/${slug}`, {
    method: 'POST',
    body: JSON.stringify({ status, ...rawFields, ...options }),
  });
}

export interface AddToLibraryOptions {
  /**
   * Whether the server should fetch whatever this payload is missing before
   * saving. Defaults to true on the server, which is right for adding one book
   * with someone waiting on it.
   *
   * An import passes false. The fields it left out are the ones the provider's
   * search response never carried — publisher most of all — so enriching costs
   * a round trip per row, and a 300-book import spent minutes on it (LOS-202).
   * Those blanks are filled instead on first view of the book.
   */
  enrich?: boolean;
}
