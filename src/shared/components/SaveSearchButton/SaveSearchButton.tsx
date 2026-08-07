import { useRef, useState } from 'react';
import { ApiError } from '../../../api/client';
import { saveCannedSearch } from '../../../api/canned-searches/pin-canned-search';
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
}

/**
 * Offers to keep a search as one of the reader's own pills, from wherever they
 * are looking at it — the Discover hero, or the results it produced.
 *
 * Saving pins as well, server-side: a saved search is never drawn as a
 * suggestion, so an unpinned one would be invisible the moment it was made.
 */
export function SaveSearchButton({ query, onSaved }: SaveSearchButtonProps) {
  const { isAuthenticated } = useAuth();
  const [savedQuery, setSavedQuery] = useState<string | null>(null);
  const inFlight = useRef(false);

  const trimmed = query.trim();
  // Saving writes a row owned by the reader, so there is nowhere to put a
  // guest's. They can still pin anything from the catalog.
  if (!isAuthenticated || trimmed.length < MIN_SAVED_QUERY_LENGTH) return null;

  // Compared against the current text rather than latched: typing on turns the
  // offer back on, which is what a reader who has edited the query expects.
  const saved = savedQuery === trimmed;

  async function handleClick() {
    // Guarded rather than disabled, so a reader pressing it twice keeps focus
    // on the button instead of being dropped back to the top of the page.
    if (inFlight.current || saved) return;
    inFlight.current = true;

    try {
      const search = await saveCannedSearch(trimmed);
      setSavedQuery(trimmed);
      onSaved?.(search);
      toast({ text: `Saved “${search.query}” as a pill.` });
    } catch (error) {
      toast({
        text:
          error instanceof ApiError && error.status === 409
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
      className={saved ? `${styles.button} ${styles.saved}` : styles.button}
      aria-disabled={saved}
      onClick={() => void handleClick()}
    >
      <PinIcon className={styles.glyph} filled={saved} />
      {saved ? 'Saved as a pill' : 'Keep this search as a pill'}
    </button>
  );
}
