import { clearGuestPinnedIds, getGuestPinnedIds } from './guest-state';
import { pinCannedSearch } from './pin-canned-search';

/**
 * Carry pins made while signed out into the account that just signed in.
 *
 * Without this, a reader who pins as a guest and then logs in watches their
 * pins vanish: the server stops reading the ids the client sends the moment the
 * request carries a token.
 *
 * Sequential rather than parallel, because the server appends each pin at the
 * end of the row — firing six at once would land them in whatever order the
 * requests happened to complete, and the reader would find their pins shuffled.
 *
 * Individual failures are swallowed on purpose. A pin can fail because the
 * account is already at the cap or the search has since been retired, and
 * neither is worth failing a sign-in over.
 */
export async function mergeGuestPins(): Promise<void> {
  const ids = getGuestPinnedIds();
  if (ids.length === 0) return;

  for (const id of ids) {
    try {
      await pinCannedSearch(id);
    } catch {
      // Cap reached or search retired. Skip it and keep the rest.
    }
  }

  clearGuestPinnedIds();
}
