import { apiFetch } from '../client';
import type { RawAiSearchBook } from '../../normalize/search';

export interface MetadataQuery {
  title: string;
  author?: string;
}

export interface GetMetadataResponse {
  books: (RawAiSearchBook | null)[];
}

export function getMetadata(books: MetadataQuery[]): Promise<GetMetadataResponse> {
  return apiFetch('/search/metadata', {
    method: 'POST',
    body: JSON.stringify({ books }),
  });
}
