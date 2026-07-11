import { apiFetch } from '../client';

export function removeEntry(bookId: number): Promise<void> {
  return apiFetch(`/library/${bookId}`, { method: 'DELETE' });
}
