import { useEffect, useState } from 'react';
import { getPublicEntry } from '../../../api/users/get-public-entry';
import { normalizeLibraryEntry } from '../../../normalize/library';
import { isAbortError } from '../../../api/client';
import type { LibraryEntrySummary } from '../../../normalize/book-detail';

/**
 * Another reader's entry for this book, when the page was reached from their
 * shelf (LOS-360).
 *
 * Null throughout when there is no handle to ask about, and null again when the
 * request fails -- which it does for every way this can be unavailable: no such
 * reader, a page not listed, a book they do not have, one they hid. A visitor
 * cannot tell those apart, so this does not either, and the page shows the
 * ordinary book rather than an error about someone else's shelf.
 */
export function useVisitorEntry(
  handle: string | undefined,
  bookId: number | undefined,
): LibraryEntrySummary | null {
  const [entry, setEntry] = useState<LibraryEntrySummary | null>(null);

  useEffect(() => {
    // No state written here for the empty case: without a handle there is
    // nothing to fetch, and "no entry" is derivable rather than remembered --
    // see the return below.
    if (!handle || !bookId) return;

    const controller = new AbortController();
    let live = true;

    getPublicEntry(handle, bookId, controller.signal)
      .then((response) => {
        if (!live) return;
        const normalized = normalizeLibraryEntry(response.entry);
        setEntry({
          status: normalized.status,
          userRating: normalized.userRating,
          isFavorite: normalized.isFavorite,
          review: normalized.review,
          // Theirs to keep: related books are the caller's own connections, and
          // this page offers none of that for someone else's copy.
          userRelatedIds: [],
        });
      })
      .catch((error) => {
        if (!live || isAbortError(error)) return;
        setEntry(null);
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [handle, bookId]);

  // Guarded rather than cleared in the effect, so a page with no `?u=` never
  // shows a previous reader's entry and the effect never writes state it could
  // have derived.
  return handle && bookId ? entry : null;
}
