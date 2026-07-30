import { apiFetch } from '../client';
import type { RawAiSearchBook } from '../../normalize/search';

/**
 * One book read off a spine. Comes back in one of three tiers:
 *   matchedBookId  -> already in the catalog
 *   resolvedBook   -> not in the catalog, but resolved against a provider
 *   neither        -> title/author read, but unresolvable
 * `resolvedBook` carries the API's SearchResult shape, identical to search's.
 */
export interface RawDetectedBook {
  title: string;
  author: string | null;
  matchedBookId?: number;
  resolvedBook?: RawAiSearchBook;
}

export interface ScanResponse {
  detectedBooks: RawDetectedBook[];
}

/** POST /upload/scan — one call for every image in the batch (1-10 keys). */
export function scanShelves(imageKeys: string[]): Promise<ScanResponse> {
  return apiFetch('/upload/scan', {
    method: 'POST',
    body: JSON.stringify({ imageKeys }),
  });
}
