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
): Promise<AddToLibraryResponse> {
  return apiFetch(`/library/${slug}`, {
    method: 'POST',
    body: JSON.stringify({ status, ...rawFields }),
  });
}
