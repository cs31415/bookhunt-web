import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getActiveRequestCount, subscribe } from '../../../api/api-activity';

/**
 * Two thresholds, both about not making the reader watch a flicker.
 *
 * A request that finishes inside the delay never shows anything at all, which
 * is most of them against a warm cache. One that crosses it stays up long
 * enough to be read as a state rather than a blink.
 */
const APPEAR_AFTER_MS = 250;
const STAY_FOR_MS = 400;

export interface ActivityVisibility {
  /** Whether anything should be drawn at all. */
  visible: boolean;
  /** True while a request is in flight, before the delay has elapsed. */
  pending: boolean;
}

/**
 * Turns the raw in-flight count into a "should the reader see this" answer.
 *
 * Kept apart from the component that draws it so the timing rules can be
 * tested on their own, and so the same rules can drive either presentation.
 */
export function useActivityVisibility(): ActivityVisibility {
  const activeCount = useSyncExternalStore(subscribe, getActiveRequestCount);
  const busy = activeCount > 0;
  const [visible, setVisible] = useState(false);
  // When the indicator went up, so the minimum can be measured from it.
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    if (busy) {
      if (visible) return;
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, APPEAR_AFTER_MS);
      return () => clearTimeout(timer);
    }

    if (!visible) return;

    // Idle again: hold the rest of the minimum, if any is left.
    const remaining = STAY_FOR_MS - (Date.now() - (shownAt.current ?? 0));
    if (remaining <= 0) {
      shownAt.current = null;
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      shownAt.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [busy, visible]);

  return { visible, pending: busy && !visible };
}
