import { useEffect, useRef, useState } from 'react';
import { ApiError, isAbortError } from '../../../api/client';
import { getCannedSearches } from '../../../api/canned-searches/get-canned-searches';
import {
  saveCannedSearch,
  unpinCannedSearch,
} from '../../../api/canned-searches/pin-canned-search';
import { MAX_PINNED_SEARCHES } from '../../../api/canned-searches/types';
import type { CannedSearch } from '../../../api/canned-searches/types';
import { useAuth } from '../../../features/auth/AuthContext';
import { PinIcon } from '../../layout/icons';
import { toast } from '../../toast/toast-store';
import styles from './SaveSearchButton.module.css';

/** Matches MIN_SAVED_QUERY_LENGTH in the API; the server enforces it with a 400. */
const MIN_SAVED_QUERY_LENGTH = 3;

const PIN_LIMIT_MESSAGE = `You can pin up to ${MAX_PINNED_SEARCHES} searches.`;

export interface SaveSearchButtonProps {
  /** The search to keep. Whitespace-only or too short renders nothing. */
  query: string;
  /** Notified with the saved row, for a caller holding a list of pinned pills. */
  onSaved?: (search: CannedSearch) => void;
  /** Notified when the reader takes one away again, for the same caller. */
  onRemoved?: (search: CannedSearch) => void;
}

function sameSearch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Offers to keep a search as one of the reader's own pills, from wherever they
 * are looking at it — the Discover hero, or the results it produced. Offers to
 * take it away again once it is one (LOS-295): arriving here from your own pill
 * and being invited to save what is already saved is an offer that does nothing,
 * since the server answers the same text idempotently.
 *
 * Saving pins as well, server-side: a saved search is never drawn as a
 * suggestion, so an unpinned one would be invisible the moment it was made.
 *
 * The pinned row is fetched here rather than passed in. Discover holds one
 * already, but the search page has no pill row of its own, and a prop would
 * leave the button right on one page and wrong on the other.
 */
export function SaveSearchButton({ query, onSaved, onRemoved }: SaveSearchButtonProps) {
  const { isAuthenticated } = useAuth();
  const [pinned, setPinned] = useState<CannedSearch[]>([]);
  const inFlight = useRef(false);

  const trimmed = query.trim();
  const offerable = isAuthenticated && trimmed.length >= MIN_SAVED_QUERY_LENGTH;

  useEffect(() => {
    // Nothing is offered without these, so nothing is asked for either.
    if (!offerable) return;

    const controller = new AbortController();
    getCannedSearches({ signal: controller.signal })
      .then((row) => setPinned(row.pinned))
      .catch((error: unknown) => {
        // A failure here costs the reader the Remove wording, not the button:
        // saving still works, and the server is idempotent about the rest.
        if (!isAbortError(error)) setPinned([]);
      });
    return () => controller.abort();
    // Once per mount and per sign-in, not per keystroke: the row is the
    // reader's pins, which the query has no bearing on.
  }, [offerable]);

  // Saving writes a row owned by the reader, so there is nowhere to put a
  // guest's. They can still pin anything from the catalog.
  if (!offerable) return null;

  // Compared on the text rather than latched to an id: typing a different
  // search turns the offer back on, which is what a reader who has edited the
  // query expects, and the pill they arrived from matches by what it says.
  const kept = pinned.find((pin) => sameSearch(pin.query, trimmed)) ?? null;

  async function handleClick() {
    // Guarded rather than disabled, so a reader pressing it twice keeps focus
    // on the button instead of being dropped back to the top of the page.
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      if (kept) {
        await unpinCannedSearch(kept.id);
        setPinned((current) => current.filter((pin) => pin.id !== kept.id));
        onRemoved?.(kept);
        toast({ text: `Removed “${kept.query}” from your pills.` });
      } else {
        const search = await saveCannedSearch(trimmed);
        setPinned((current) => [...current, search]);
        onSaved?.(search);
        toast({ text: `Saved “${search.query}” as a pill.` });
      }
    } catch (error) {
      toast({
        text: kept
          ? 'Could not remove that pill. Please try again.'
          : error instanceof ApiError && error.status === 409
            ? PIN_LIMIT_MESSAGE
            : 'Could not save that search. Please try again.',
      });
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <button
      type="button"
      className={kept ? `${styles.button} ${styles.saved}` : styles.button}
      onClick={() => void handleClick()}
    >
      <PinIcon className={styles.glyph} filled={Boolean(kept)} />
      {kept ? 'Remove this search as a pill' : 'Keep this search as a pill'}
    </button>
  );
}
