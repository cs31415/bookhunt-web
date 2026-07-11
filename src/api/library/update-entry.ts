import { apiFetch } from '../client';
import type { LibraryStatus } from '../../shared/types/library-status';

export interface UpdateEntryParams {
  status?: LibraryStatus;
  userRating?: number;
  notes?: string;
  review?: string;
}

export function updateEntry(bookId: number, params: UpdateEntryParams): Promise<{ entry: unknown }> {
  return apiFetch(`/library/${bookId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}
