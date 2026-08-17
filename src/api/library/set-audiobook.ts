import { apiFetch } from '../client';
import type { LibraryFlags } from './set-favorite';

// Matches PUT|DELETE /library/:bookId/audiobook (LOS-273). Independent of the
// ebook flag: setting one never clears the other, because a reader can own the
// Kindle and the Audible copy of the same book.
export function setAudiobook(
  bookId: number,
  isAudiobook: boolean,
): Promise<{ entry: LibraryFlags }> {
  return apiFetch(`/library/${bookId}/audiobook`, {
    method: isAudiobook ? 'PUT' : 'DELETE',
  });
}
