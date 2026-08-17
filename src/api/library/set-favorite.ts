import { apiFetch } from '../client';

// Matches PUT|DELETE /library/:bookId/favorite (LOS-249). The state is in the
// verb rather than a body, so there is nothing to parse and no way for the two
// to disagree. 404 when the reader does not own the book.
export interface LibraryFlags {
  user_id: number;
  book_id: number;
  is_favorite: boolean;
  is_hidden: boolean;
  // Optional: the favourite and hidden functions predate these columns and were
  // not re-signed for them, so only the format endpoints return them
  // (LOS-271, LOS-273).
  is_ebook?: boolean;
  is_audiobook?: boolean;
}

export function setFavorite(bookId: number, isFavorite: boolean): Promise<{ entry: LibraryFlags }> {
  return apiFetch(`/library/${bookId}/favorite`, {
    method: isFavorite ? 'PUT' : 'DELETE',
  });
}
