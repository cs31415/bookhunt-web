import { apiFetch } from '../client';

export interface GetSummaryResponse {
  bookId: number;
  summary: string;
  generatedAt: string | null;
}

export function getSummary(bookId: number): Promise<GetSummaryResponse> {
  return apiFetch(`/ai/summary/${bookId}`);
}
