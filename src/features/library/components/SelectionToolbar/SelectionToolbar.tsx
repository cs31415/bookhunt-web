import styles from './SelectionToolbar.module.css';

export interface SelectionToolbarProps {
  selectedCount: number;
  /** How many books the current filter shows — what "Select all" would reach. */
  visibleCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onRemove: () => void;
  onDone: () => void;
}

/**
 * The bar shown while picking books to remove.
 *
 * "Select all" takes the filtered set, not the whole library, and says so by
 * naming the number — a reader who has filtered to "Abandoned" and clicks it
 * should not be selecting the books they are still reading.
 */
export function SelectionToolbar({
  selectedCount,
  visibleCount,
  onSelectAll,
  onClear,
  onRemove,
  onDone,
}: SelectionToolbarProps) {
  const allSelected = selectedCount > 0 && selectedCount === visibleCount;

  return (
    <div className={styles.bar} role="region" aria-label="Selected books">
      <span className={styles.count} aria-live="polite">
        {selectedCount === 0
          ? 'Select books to remove'
          : `${selectedCount} selected`}
      </span>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.link}
          onClick={allSelected ? onClear : onSelectAll}
          disabled={visibleCount === 0}
        >
          {allSelected ? 'Clear' : `Select all ${visibleCount}`}
        </button>
        <button type="button" className={styles.link} onClick={onDone}>
          Done
        </button>
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          disabled={selectedCount === 0}
        >
          Remove{selectedCount > 0 ? ` ${selectedCount}` : ''}
        </button>
      </div>
    </div>
  );
}
