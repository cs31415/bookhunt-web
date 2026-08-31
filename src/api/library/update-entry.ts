import { apiFetch } from '../client';
import type { LibraryStatus } from '../../shared/types/library-status';

export interface UpdateEntryParams {
  status?: LibraryStatus;
  userRating?: number;
  /** The reader's own words. The two fields this replaced -- notes, which was
      written, and review, which never was -- became one in LOS-266. */
  review?: string;
}

export function updateEntry(bookId: number, params: UpdateEntryParams): Promise<{ entry: unknown }> {
  return apiFetch(`/library/${bookId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}
