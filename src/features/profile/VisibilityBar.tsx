import styles from './ProfilePage.module.css';

export interface VisibilityBarProps {
  /** How many of the listed items would appear on the public page. */
  publicCount: number;
  total: number;
  onSetAll: (shown: boolean) => void;
  /** Staged but unwritten changes. Zero means no Save and no Cancel. */
  dirtyCount: number;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * The owner's row above a list: what is public, one button to flip the lot, and
 * Save once the ticks have been moved.
 *
 * Shared by the book grid and the author list rather than written twice — the
 * two differ only in what a row is.
 */
export function VisibilityBar({
  publicCount,
  total,
  onSetAll,
  dirtyCount,
  saving,
  onSave,
  onCancel,
}: VisibilityBarProps) {
  // Nothing to count and nothing to flip: the list itself already says so.
  if (total === 0) return null;

  const allPublic = publicCount === total;

  return (
    <div className={styles.bulkRow}>
      <span className={styles.bulkCount}>
        {publicCount} of {total} shown publicly
      </span>

      {dirtyCount > 0 && (
        <span className={styles.dirtyCount} role="status">
          {dirtyCount} unsaved
        </span>
      )}

      {/* Named for what it reaches, the way the library's toolbar is: "all"
          means the list on screen. It stages like any other tick. */}
      <button
        type="button"
        className={styles.bulkButton}
        onClick={() => onSetAll(!allPublic)}
        disabled={saving}
      >
        {allPublic ? `Hide all ${total}` : `Show all ${total}`}
      </button>

      {dirtyCount > 0 && (
        <>
          <button
            type="button"
            className={styles.bulkButton}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" className={styles.saveButton} onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      )}
    </div>
  );
}
