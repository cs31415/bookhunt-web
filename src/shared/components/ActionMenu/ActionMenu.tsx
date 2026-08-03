import { useEffect, useRef, useState } from 'react';
import type { LibraryStatus } from '../../types/library-status';
import { ALL_LIBRARY_STATUSES, LIBRARY_STATUS_LABELS } from '../../types/library-status';
import styles from './ActionMenu.module.css';

export interface ActionMenuProps {
  current: LibraryStatus;
  onSelect: (status: LibraryStatus) => void;
  /**
   * Offered below the statuses when given. This menu is the only control a book
   * already in the library has on its own page — without it there was no way to
   * take a book back out from there at all (LOS-206).
   */
  onRemove?: () => void;
}

export function ActionMenu({ current, onSelect, onRemove }: ActionMenuProps) {
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
    <div className={styles.wrap} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {LIBRARY_STATUS_LABELS[current]}
      </button>
      {open && (
        <ul className={styles.menu} role="menu">
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
              {LIBRARY_STATUS_LABELS[status]}
            </li>
          ))}
          {onRemove && (
            // Separated from the statuses: the others change how a book is
            // filed, this one takes it off the shelf and cannot be undone.
            <li
              role="menuitem"
              tabIndex={0}
              className={`${styles.item} ${styles.remove}`}
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                setOpen(false);
                onRemove();
              }}
            >
              Remove from library
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
