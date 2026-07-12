import { apiFetch } from '../client';
import type { RawAiSearchResponse } from '../../normalize/search';

export interface AiSearchParams {
  query: string;
  inLibraryOnly?: boolean;
  limit?: number;
}

export function aiSearch(params: AiSearchParams, signal?: AbortSignal): Promise<RawAiSearchResponse> {
  return apiFetch('/ai/search', {
    method: 'POST',
    body: JSON.stringify(params),
    signal,
  });
}
