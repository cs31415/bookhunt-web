import { apiFetch } from '../client';
import type { GetSummaryResponse } from './get-summary';

export function regenerateSummary(bookId: number): Promise<GetSummaryResponse> {
  return apiFetch(`/ai/summary/${bookId}`, { method: 'POST' });
}
