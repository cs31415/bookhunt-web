import { apiFetch } from '../client';

export interface GenerateThemesResponse {
  genres: string[];
  themes: string[];
  moods: string[];
}

export function generateThemes(bookId: number): Promise<GenerateThemesResponse> {
  return apiFetch(`/ai/themes/${bookId}`, { method: 'POST' });
}
