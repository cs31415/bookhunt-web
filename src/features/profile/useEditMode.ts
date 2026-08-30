import { useCallback, useEffect, useRef, useState } from 'react';

export interface EditMode {
  editing: boolean;
  enter: () => void;
  /** Leaves the mode and drops whatever was staged. */
  exit: () => void;
}

/**
 * Whether the owner is editing what their public page shows.
 *
 * The same shape as the library's selection mode (LOS-245): a button to enter,
 * a toolbar that owns leaving, and Escape as the way out -- which is how every
 * other transient state on these pages is dismissed.
 *
 * Leaving discards. Staged ticks are unsaved by definition and the bar counts
 * them aloud while they exist, so there is one meaning for backing out rather
 * than two: Escape and Cancel do the same thing.
 */
export function useEditMode(onDiscard: () => void): EditMode {
  const [editing, setEditing] = useState(false);

  // Held in a ref so a fresh closure from the page above does not rebuild the
  // key listener on every render.
  const discardRef = useRef(onDiscard);
  useEffect(() => {
    discardRef.current = onDiscard;
  });

  const exit = useCallback(() => {
    setEditing(false);
    discardRef.current();
  }, []);

  useEffect(() => {
    if (!editing) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') exit();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editing, exit]);

  return { editing, enter: useCallback(() => setEditing(true), []), exit };
}
