import { apiFetch } from '../client';

// Matches GET /users/search (LOS-254). Only readers who have made their page
// public are findable.
export interface UserSummary {
  handle: string;
  displayName: string;
  bookCount: number;
}

export function searchUsers(query: string, signal?: AbortSignal): Promise<{ users: UserSummary[] }> {
  return apiFetch(`/users/search?q=${encodeURIComponent(query)}`, { signal, silent: true });
}
