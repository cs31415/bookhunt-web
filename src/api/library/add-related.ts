import { apiFetch } from '../client';

export function addRelated(bookId: number, relatedBookId: number): Promise<{ userRelated: number[] }> {
  return apiFetch(`/library/${bookId}/related`, {
    method: 'POST',
    body: JSON.stringify({ relatedBookId }),
  });
}
