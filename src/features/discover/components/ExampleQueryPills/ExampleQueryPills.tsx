import { useState } from 'react';
import { ChevronIcon, PinIcon, RefreshIcon } from '../../../../shared/layout/icons';
import type { CannedSearch } from '../../../../api/canned-searches/types';
import styles from './ExampleQueryPills.module.css';

export interface ExampleQueryPillsProps {
  pinned: CannedSearch[];
  suggested: CannedSearch[];
  onPick: (query: string) => void;
  /** Omit to render the pills without pin controls, e.g. against the fallback list. */
  onTogglePin?: (search: CannedSearch) => void;
  /** Omit to render the row without the refresh and history controls. */
  onRefresh?: () => void;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
}

interface PillProps {
  search: CannedSearch;
  isPinned: boolean;
  onPick: (query: string) => void;
  onTogglePin?: (search: CannedSearch) => void;
}

function Pill({ search, isPinned, onPick, onTogglePin }: PillProps) {
  // A wrapper holding two sibling buttons rather than one button containing
  // another: nesting them is invalid HTML, and browsers recover from it by
  // dropping the inner control out of the tab order entirely.
  return (
    <span className={styles.pill}>
      <button type="button" className={styles.query} onClick={() => onPick(search.query)}>
        {search.query}
      </button>

      {onTogglePin && (
        <button
          type="button"
          className={`${styles.pin} ${isPinned ? styles.pinnedPin : ''}`}
          // Named, because "Pin" alone tells a screen reader nothing about
          // which of six pills it is sitting on.
          aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${search.query}`}
          aria-pressed={isPinned}
          onClick={() => onTogglePin(search)}
        >
          <PinIcon className={styles.pinGlyph} filled={isPinned} />
        </button>
      )}
    </span>
  );
}

interface StepProps {
  direction: 'left' | 'right';
  label: string;
  enabled: boolean;
  onClick: () => void;
}

function HistoryStep({ direction, label, enabled, onClick }: StepProps) {
  return (
    <button
      type="button"
      className={`${styles.step} ${enabled ? '' : styles.stepSpent}`}
      aria-label={label}
      // aria-disabled rather than disabled, for the same reason the refresh
      // glyph is never disabled: a browser drops focus from a button that
      // becomes disabled, so walking back to the oldest row with the keyboard
      // would dump the reader at the top of the page.
      aria-disabled={!enabled}
      onClick={() => { if (enabled) onClick(); }}
    >
      <ChevronIcon className={styles.stepGlyph} direction={direction} />
    </button>
  );
}

export function ExampleQueryPills({
  pinned,
  suggested,
  onPick,
  onTogglePin,
  onRefresh,
  onBack,
  onForward,
  canGoBack = false,
  canGoForward = false,
}: ExampleQueryPillsProps) {
  // Local to the animation, not to the request: a fast refetch would otherwise
  // finish before the turn is visible, and a slow one would spin for as long as
  // the network felt like taking.
  const [spinning, setSpinning] = useState(false);

  return (
    <div className={styles.row}>
      {pinned.map((search) => (
        <Pill
          key={search.id}
          search={search}
          isPinned
          onPick={onPick}
          onTogglePin={onTogglePin}
        />
      ))}

      {suggested.map((search) => (
        // Keyed by text, not id: the fallback list has no real ids, and the
        // catalog holds query UNIQUE, so it is a stable key either way.
        <Pill
          key={search.query}
          search={search}
          isPinned={false}
          onPick={onPick}
          onTogglePin={onTogglePin}
        />
      ))}

      {onRefresh && (
        <span className={styles.controls}>
          {onBack && (
            <HistoryStep
              direction="left"
              label="Previous searches"
              enabled={canGoBack}
              onClick={onBack}
            />
          )}

          <button
            type="button"
            className={styles.refresh}
            aria-label="Show different searches"
            onClick={() => {
              setSpinning(true);
              onRefresh();
            }}
            onAnimationEnd={() => setSpinning(false)}
          >
            <RefreshIcon className={`${styles.refreshGlyph} ${spinning ? styles.spinning : ''}`} />
          </button>

          {onForward && (
            <HistoryStep
              direction="right"
              label="Next searches"
              enabled={canGoForward}
              onClick={onForward}
            />
          )}
        </span>
      )}
    </div>
  );
}
