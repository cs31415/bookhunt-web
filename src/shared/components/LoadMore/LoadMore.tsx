import { useEffect, useRef, useState } from 'react';
import { pluralize } from '../../lib/text';
import styles from './LoadMore.module.css';

export interface LoadMoreProps {
  /** How many rows are on screen now. */
  shown: number;
  /** How many there are altogether. */
  total: number;
  /** Asks for the next slice. */
  onMore: () => void;
  /** A slice is in flight. The button says so, and the observer holds off. */
  busy?: boolean;
  /** Singular noun for the count; pluralized against the total. */
  noun?: string;
}

/**
 * How many slices the observer may fetch before it stops and waits to be asked.
 *
 * Not unbounded, and this is the whole reason the limit exists: a shelf that
 * grows every time you approach its end has no end, so the footer under it can
 * never be reached. After this many the reader is at a resting point with the
 * page still, and a press starts another run.
 */
const AUTO_LOADS = 2;

/**
 * The foot of a shelf: how far through it you are, and the way to see more.
 *
 * A button rather than a bare sentinel, because an IntersectionObserver only
 * fires on scroll -- anyone arriving by keyboard would tab into a shelf they
 * could not extend. The observer watches this same button, so both doors lead
 * to the same place instead of being two mechanisms to keep in step.
 */
export function LoadMore({ shown, total, onMore, busy = false, noun = 'book' }: LoadMoreProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [autoLoads, setAutoLoads] = useState(0);
  const done = shown >= total;

  /**
   * `onMore` is usually a fresh closure each render, so it is held in a ref
   * rather than named as a dependency -- as a dependency it would tear down and
   * rebuild the observer on every render of the page above.
   */
  const onMoreRef = useRef(onMore);
  useEffect(() => {
    onMoreRef.current = onMore;
  });

  useEffect(() => {
    if (done || busy || autoLoads >= AUTO_LOADS) return;
    const node = buttonRef.current;
    // No IntersectionObserver -- jsdom, chiefly -- leaves the button, which is
    // the point of it being a button.
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setAutoLoads((n) => n + 1);
      onMoreRef.current();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, busy, autoLoads, shown]);

  if (total === 0) return null;

  /**
   * Announced as it grows, so the shelf lengthening is not a silent event for a
   * reader who cannot see it happen. Polite: it is a progress report, and has no
   * business interrupting whatever is being read.
   */
  const count = (
    <p className={styles.count} aria-live="polite">
      {done ? `All ${total} ${pluralize(total, noun)}` : `${shown} of ${total} ${pluralize(total, noun)}`}
    </p>
  );

  if (done) return <div className={styles.foot}>{count}</div>;

  return (
    <div className={styles.foot}>
      {count}
      <button
        type="button"
        ref={buttonRef}
        className={styles.button}
        // A press is a deliberate ask, so it earns another run of automatic
        // ones. Without this the shelf would load two slices and then need a
        // press for every slice after.
        onClick={() => {
          setAutoLoads(0);
          onMore();
        }}
        disabled={busy}
      >
        {busy ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
