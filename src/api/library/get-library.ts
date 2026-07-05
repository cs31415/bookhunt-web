import { apiFetch } from '../client';
import type { RawLibraryEntry, RawLibraryStats } from '../../normalize/library';

export interface GetLibraryResponse {
  entries: RawLibraryEntry[];
  stats: RawLibraryStats;
}

export function getLibrary(): Promise<GetLibraryResponse> {
  return apiFetch('/library');
}
