import { apiFetch } from '../client';

// Matches POST|DELETE /authors/:slug/favorite (LOS-255). The verb carries the
// state, as the library flags do. Idempotent; 404 for an unknown slug.
export function setAuthorFavorite(slug: string, isFavorite: boolean): Promise<{ ok: true }> {
  return apiFetch(`/authors/${encodeURIComponent(slug)}/favorite`, {
    method: isFavorite ? 'POST' : 'DELETE',
  });
}
