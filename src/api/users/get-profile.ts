import { apiFetch } from '../client';

// Matches GET /users/:handle (LOS-256). 404 for an unknown handle and for one
// whose page is private, deliberately indistinguishable.
export interface RawPublicProfile {
  handle: string;
  displayName: string;
  joinedAt: string;
  counts: { total: number; reading: number; finished: number; favorites: number };
}

export function getProfile(handle: string, signal?: AbortSignal): Promise<{ profile: RawPublicProfile }> {
  return apiFetch(`/users/${encodeURIComponent(handle)}`, { signal });
}
