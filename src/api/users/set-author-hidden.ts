import { apiFetch } from '../client';

// Matches PUT|DELETE /authors/:slug/favorite/hidden (LOS-282). The verb carries
// the state, as it does for a book: PUT keeps the author off the public page,
// DELETE puts them back. The author stays favourited either way — this changes
// only what a visitor to bookhunt.net/<handle> sees.
export function setAuthorHidden(
  slug: string,
  isHidden: boolean,
): Promise<{ author: { slug: string; isHidden: boolean } }> {
  return apiFetch(`/authors/${encodeURIComponent(slug)}/favorite/hidden`, {
    method: isHidden ? 'PUT' : 'DELETE',
  });
}
