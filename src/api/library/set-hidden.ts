import { apiFetch } from '../client';
import type { LibraryFlags } from './set-favorite';

// Matches PUT|DELETE /library/:bookId/hidden (LOS-249). The verb carries the
// state: PUT hides the book from the public profile, DELETE shows it again.
// Affects only bookhunt.net/<handle>; the owner's own library is unchanged.
export function setHidden(bookId: number, isHidden: boolean): Promise<{ entry: LibraryFlags }> {
  return apiFetch(`/library/${bookId}/hidden`, {
    method: isHidden ? 'PUT' : 'DELETE',
  });
}
