import { apiFetch } from '../client';
import type { RawGetAuthorResponse } from '../../normalize/author';

export function getAuthor(slug: string): Promise<RawGetAuthorResponse> {
  return apiFetch(`/authors/${slug}`);
}
