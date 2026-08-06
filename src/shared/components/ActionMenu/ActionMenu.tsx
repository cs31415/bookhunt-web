import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LibraryStatus } from '../../types/library-status';
import {
  ALL_LIBRARY_STATUSES,
  LIBRARY_STATUS_GLYPHS,
  LIBRARY_STATUS_LABELS,
} from '../../types/library-status';
import styles from './ActionMenu.module.css';

/** Filing only — removal is its own button beside this menu (LOS-207). */
export interface ActionMenuProps {
  current: LibraryStatus;
  onSelect: (status: LibraryStatus) => void;
  /**
   * Replaces the default text trigger. The book page hands in a CoverFold, so
   * the dog-ear on the cover is itself what opens the menu; whatever is given
   * must carry the status as text for the button to have an accessible name.
   */
  trigger?: ReactNode;
  /** Applied to the positioning wrapper, for callers that place the menu. */
  className?: string;
  /** Which edge the dropdown hangs from — right when the trigger sits at one. */
  align?: 'left' | 'right';
}

export function ActionMenu({ current, onSelect, trigger, className, align = 'left' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={className ? `${styles.wrap} ${className}` : styles.wrap} ref={containerRef}>
      <button
        type="button"
        className={trigger ? styles.bareTrigger : styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger ?? LIBRARY_STATUS_LABELS[current]}
      </button>
      {open && (
        <ul className={align === 'right' ? `${styles.menu} ${styles.menuRight}` : styles.menu} role="menu">
          {ALL_LIBRARY_STATUSES.map((status) => (
            <li
              key={status}
              role="menuitemradio"
              aria-checked={status === current}
              className={status === current ? `${styles.item} ${styles.current}` : styles.item}
              onClick={() => {
                onSelect(status);
                setOpen(false);
              }}
            >
              {/* The same mark the cover fold carries, so which fold means what
                  is learnable from the menu that sets it. */}
              <span
                className={
                  status === 'abandoned' ? `${styles.glyph} ${styles.glyphAbandoned}` : styles.glyph
                }
                aria-hidden="true"
              >
                {LIBRARY_STATUS_GLYPHS[status]}
              </span>
              {LIBRARY_STATUS_LABELS[status]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
