import { apiFetch } from '../client';

// Matches POST|DELETE /users/:handle/favorite (LOS-254). Idempotent. A mutual
// pair is what permits messaging, so removing one is also how you block.
export function setUserFavorite(handle: string, isFavorite: boolean): Promise<{ ok: true }> {
  return apiFetch(`/users/${encodeURIComponent(handle)}/favorite`, {
    method: isFavorite ? 'POST' : 'DELETE',
  });
}
