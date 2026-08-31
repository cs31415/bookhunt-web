import { useEffect, useRef, useState } from 'react';
import styles from './LibraryCardMenu.module.css';

export interface LibraryCardMenuProps {
  onRemove: () => void;
  isFavorite: boolean;
  onToggleFavorite: (next: boolean) => void;
  isHidden: boolean;
  onToggleHidden: (next: boolean) => void;
  /** null means this book follows the reader's global setting (LOS-266). */
  shareReview: boolean | null;
  onSetShareReview: (next: boolean | null) => void;
  isEbook: boolean;
  onToggleEbook: (next: boolean) => void;
  isAudiobook: boolean;
  onToggleAudiobook: (next: boolean) => void;
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
  shareReview,
  onSetShareReview,
  isEbook,
  onToggleEbook,
  isAudiobook,
  onToggleAudiobook,
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
          {/*
            Three states, so radios in a group rather than the checkbox items
            above: Default follows the reader's global setting, and the other two
            override it in either direction (LOS-266).
            
            A group with its own label, because "Default" means nothing on its
            own -- it needs the question it is answering next to it.
          */}
          <li role="none" className={styles.groupLabel}>
            Review on my public page
          </li>
          {(
            [
              [undefined, 'Default'],
              [true, 'Always show'],
              [false, 'Never show'],
            ] as const
          ).map(([value, label]) => {
            const next = value === undefined ? null : value;
            return (
              <li
                key={label}
                role="menuitemradio"
                aria-checked={shareReview === next}
                tabIndex={0}
                className={styles.item}
                onClick={() => {
                  setOpen(false);
                  onSetShareReview(next);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  setOpen(false);
                  onSetShareReview(next);
                }}
              >
                {label}
              </li>
            );
          })}
          {/* Below the flags that change what others see, because this one
              only describes the copy on the shelf. */}
          <li
            role="menuitemcheckbox"
            aria-checked={isEbook}
            tabIndex={0}
            className={styles.item}
            onClick={() => {
              setOpen(false);
              onToggleEbook(!isEbook);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              setOpen(false);
              onToggleEbook(!isEbook);
            }}
          >
            {isEbook ? 'Mark as physical book' : 'Mark as ebook'}
          </li>
          {/* Its own item rather than a third state of the one above: owning
              both the Kindle and the Audible copy is ordinary, so neither
              clears the other. */}
          <li
            role="menuitemcheckbox"
            aria-checked={isAudiobook}
            tabIndex={0}
            className={styles.item}
            onClick={() => {
              setOpen(false);
              onToggleAudiobook(!isAudiobook);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              setOpen(false);
              onToggleAudiobook(!isAudiobook);
            }}
          >
            {isAudiobook ? 'Not an audiobook' : 'Mark as audiobook'}
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
