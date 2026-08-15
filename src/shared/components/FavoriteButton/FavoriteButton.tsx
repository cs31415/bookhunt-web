import styles from './FavoriteButton.module.css';

export interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}

/**
 * The heart, wherever a thing can be favourited. Shared rather than
 * library-specific because LOS-255 hangs the same control off an author.
 *
 * aria-pressed rather than two labels: a toggle button that keeps one name and
 * reports its state is read correctly by every screen reader, whereas a label
 * that flips between "Favourite" and "Unfavourite" is ambiguous about whether
 * it describes the current state or what the click will do.
 *
 * The name says only what the control does, not which book it acts on. BookCard
 * wraps a card carrying an overlay in a group named for the title, so the
 * context is already there -- and repeating it would give every card in a grid
 * a second button whose name contains the book's, which is ambiguous to a
 * screen reader and to anything else querying by accessible name.
 */
export function FavoriteButton({ isFavorite, onToggle, disabled }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      className={isFavorite ? `${styles.button} ${styles.on}` : styles.button}
      aria-pressed={isFavorite}
      aria-label="Favourite"
      disabled={disabled}
      onClick={(event) => {
        // The heart sits on top of a card that is itself a button. Without this
        // the click favourites the book and opens it.
        event.stopPropagation();
        onToggle(!isFavorite);
      }}
    >
      {/* Filled and outlined are two paths rather than a CSS trick, so the
          difference survives a high-contrast mode that flattens colour. */}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path
          d="M12 20.5 3.8 12.3a5 5 0 0 1 7.1-7.1l1.1 1.1 1.1-1.1a5 5 0 0 1 7.1 7.1Z"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
