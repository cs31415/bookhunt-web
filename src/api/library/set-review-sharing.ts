import { apiFetch } from '../client';

export interface ReviewSharing {
  user_id: number;
  book_id: number;
  /** null means "follow the global setting". */
  share_review: boolean | null;
}

/**
 * Matches PUT /library/:bookId/review-sharing (LOS-266).
 *
 * A body rather than a verb, where `hidden` and `favorite` use PUT and DELETE:
 * there are three states here, not two, and null is one of them -- it is how a
 * book is put back to following the reader's global setting.
 */
export function setReviewSharing(
  bookId: number,
  share: boolean | null,
): Promise<{ entry: ReviewSharing }> {
  return apiFetch(`/library/${bookId}/review-sharing`, {
    method: 'PUT',
    body: JSON.stringify({ share }),
  });
}
