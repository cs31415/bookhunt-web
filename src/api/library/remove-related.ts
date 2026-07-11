import { apiFetch } from '../client';

export function removeRelated(bookId: number, relatedBookId: number): Promise<{ userRelated: number[] }> {
  return apiFetch(`/library/${bookId}/related/${relatedBookId}`, { method: 'DELETE' });
}
