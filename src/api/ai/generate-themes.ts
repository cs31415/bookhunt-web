import { apiFetch } from '../client';

export interface GenerateThemesResponse {
  genres: string[];
  themes: string[];
  moods: string[];
}

export function generateThemes(bookId: number): Promise<GenerateThemesResponse> {
  return apiFetch(`/ai/themes/${bookId}`, { method: 'POST', silent: true });
}

export function generateThemesExternal(title: string, authorName: string): Promise<GenerateThemesResponse> {
  return apiFetch('/ai/themes/external', {
    method: 'POST',
    body: JSON.stringify({ title, authorName }),
    silent: true,
  });
}
