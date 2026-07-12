import { apiFetch } from '../client';

export interface ResolveOrCreateBookParams {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  title: string;
  authorName: string;
  year?: number | null;
  publisher?: string | null;
  pages?: number | null;
  rating?: number | null;
  subjects?: string[] | null;
  blurb?: string | null;
  coverUrl?: string | null;
  isbn13?: string | null;
  language?: string | null;
}

export interface ResolveOrCreateBookResponse {
  book: {
    id: number;
    slug: string;
  };
}

/**
 * Get-or-create a catalog row for a search result so its detail page can
 * load, without adding it to the caller's library (a separate action).
 * Requires auth, matching the existing precedent for catalog writes.
 */
export function resolveOrCreateBook(
  params: ResolveOrCreateBookParams,
): Promise<ResolveOrCreateBookResponse> {
  return apiFetch('/books', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
