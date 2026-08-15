import { useEffect, useRef, useState } from 'react';
import styles from './LibraryCardMenu.module.css';

export interface LibraryCardMenuProps {
  onRemove: () => void;
  isFavorite: boolean;
  onToggleFavorite: (next: boolean) => void;
  isHidden: boolean;
  onToggleHidden: (next: boolean) => void;
}

/**
 * The per-card menu on the library grid.
 *
 * The dismiss handling mirrors shared/components/ActionMenu — pointer-down
 * outside and Escape both close. Not shared with it: that one is a status
 * picker with a status-shaped API, and the only thing common to the two is
 * twenty lines of event wiring.
 */
export function LibraryCardMenu({
  onRemove,
  isFavorite,
  onToggleFavorite,
  isHidden,
  onToggleHidden,
}: LibraryCardMenuProps) {
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
          {/* Duplicates the heart on the cover on purpose: the heart is quick
              but small, and the menu is where someone goes looking for what a
              card can do. */}
          <li
            role="menuitemcheckbox"
            aria-checked={isFavorite}
            tabIndex={0}
            className={styles.item}
            onClick={() => {
              setOpen(false);
              onToggleFavorite(!isFavorite);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              setOpen(false);
              onToggleFavorite(!isFavorite);
            }}
          >
            {isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          </li>
          <li
            role="menuitemcheckbox"
            aria-checked={isHidden}
            tabIndex={0}
            className={styles.item}
            onClick={() => {
              setOpen(false);
              onToggleHidden(!isHidden);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              setOpen(false);
              onToggleHidden(!isHidden);
            }}
          >
            {isHidden ? 'Show on my public page' : 'Hide from my public page'}
          </li>
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
