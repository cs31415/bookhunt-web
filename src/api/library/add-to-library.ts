import { apiFetch } from '../client';
import type { LibraryStatus } from '../../shared/types/library-status';

// Uses POST /library/:bookId (add an existing catalog book by internal id),
// not the upsert-based POST /library — that endpoint's no-external-id branch
// creates a duplicate `books` row for books already in the catalog.
export function addToLibrary(bookId: number, status: LibraryStatus = 'queued'): Promise<{ entry: unknown }> {
  return apiFetch(`/library/${bookId}`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}
