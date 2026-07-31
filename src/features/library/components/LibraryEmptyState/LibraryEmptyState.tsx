import { LibraryIcon } from '../../../../shared/layout/icons';
import styles from './LibraryEmptyState.module.css';

export interface LibraryEmptyStateProps {
  onDiscover: () => void;
  /** Omitted when photo import is disabled — the button is then not rendered. */
  onAddFromPhoto?: () => void;
  onImportCsv: () => void;
}

export function LibraryEmptyState({
  onDiscover,
  onAddFromPhoto,
  onImportCsv,
}: LibraryEmptyStateProps) {
  return (
    <div className={styles.empty}>
      <LibraryIcon className={styles.icon} />
      <h1 className={styles.heading}>Your shelves are empty</h1>
      <p className={styles.hint}>
        Add books you're reading, want to read, or have finished — and watch your library take shape.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onDiscover}>
          Discover books
        </button>
        <button type="button" className={styles.secondary} onClick={onImportCsv}>
          Import from CSV
        </button>
        {onAddFromPhoto && (
          <button type="button" className={styles.secondary} onClick={onAddFromPhoto}>
            Add from a photo
          </button>
        )}
      </div>
    </div>
  );
}
