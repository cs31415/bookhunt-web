import { apiFetch } from '../client';
import type { LibraryFlags } from './set-favorite';

// Matches PUT|DELETE /library/:bookId/ebook (LOS-271). The verb carries the
// state: PUT marks the copy as an ebook, DELETE returns it to physical.
export function setEbook(bookId: number, isEbook: boolean): Promise<{ entry: LibraryFlags }> {
  return apiFetch(`/library/${bookId}/ebook`, {
    method: isEbook ? 'PUT' : 'DELETE',
  });
}
