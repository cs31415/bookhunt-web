import { apiFetch } from '../client';

/**
 * The unlisted share link (LOS-305).
 *
 * There is no separate "unlisted" flag: a null token means the reader has none,
 * which — with the public page off — is what private means. Creating and
 * regenerating are one call, because overwriting is the only way to take back a
 * link that has spread.
 */
export interface ShareLinkResponse {
  token: string | null;
}

export function getShareLink(signal?: AbortSignal): Promise<ShareLinkResponse> {
  return apiFetch('/users/me/share-link', { signal });
}

/** Mints a token, replacing any that exists. The old link stops working. */
export function createShareLink(): Promise<ShareLinkResponse> {
  return apiFetch('/users/me/share-link', { method: 'POST' });
}

/** Back to private. */
export function deleteShareLink(): Promise<ShareLinkResponse> {
  return apiFetch('/users/me/share-link', { method: 'DELETE' });
}
