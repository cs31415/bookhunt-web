import { useEffect, useRef, useState } from 'react';
import styles from './LibraryCardMenu.module.css';

export interface LibraryCardMenuProps {
  onRemove: () => void;
}

/**
 * The per-card menu on the library grid. One item today; the shape is what
 * grows when there is a second.
 *
 * The dismiss handling mirrors shared/components/ActionMenu — pointer-down
 * outside and Escape both close. Not shared with it: that one is a status
 * picker with a status-shaped API, and the only thing common to the two is
 * twenty lines of event wiring.
 */
export function LibraryCardMenu({ onRemove }: LibraryCardMenuProps) {
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
        aria-label="Book actions"
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open && (
        <ul className={styles.menu} role="menu">
          <li
            role="menuitem"
            tabIndex={0}
            className={styles.remove}
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
        </ul>
      )}
    </div>
  );
}
