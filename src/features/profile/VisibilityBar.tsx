import styles from './ProfilePage.module.css';

export interface VisibilityBarProps {
  /** How many of the listed items would appear on the public page. */
  publicCount: number;
  total: number;
  /** Whether the ticks are on show. The list above renders them off this too. */
  editing: boolean;
  onEdit: () => void;
  /** Leaves the mode, dropping anything staged. */
  onExit: () => void;
  onSetAll: (shown: boolean) => void;
  /** Staged but unwritten changes. Zero means no Save and no Cancel. */
  dirtyCount: number;
  saving: boolean;
  onSave: () => void;
}

/**
 * The owner's row above a list: what is public, and -- once Edit is pressed --
 * the ticks, the two bulk buttons, and Save.
 *
 * Shared by the book grid and the author list rather than written twice: the
 * two differ only in what a row is.
 *
 * The bulk buttons stage, exactly as the ticks do, so Save still means the one
 * thing (LOS-346). Writing immediately would have left Save meaning "commit the
 * ticks, but the bulk buttons already went" -- two rules for one bar.
 */
export function VisibilityBar({
  publicCount,
  total,
  editing,
  onEdit,
  onExit,
  onSetAll,
  dirtyCount,
  saving,
  onSave,
}: VisibilityBarProps) {
  // Nothing to count and nothing to flip: the list itself already says so.
  if (total === 0) return null;

  return (
    <div className={styles.bulkRow}>
      <span className={styles.bulkCount}>
        {publicCount} of {total} shown publicly
      </span>

      {!editing ? (
        <button type="button" className={styles.bulkButton} onClick={onEdit}>
          Edit
        </button>
      ) : (
        <>
          {dirtyCount > 0 && (
            <span className={styles.dirtyCount} role="status">
              {dirtyCount} unsaved
            </span>
          )}

          {/*
           * Two buttons rather than one that flips. A single toggle has to read
           * the list to decide what it means, which makes it a different button
           * on a mixed list than on a uniform one; these two always say what
           * they do.
           *
           * No longer disabled on "everything already agrees" (LOS-358). They
           * are a selection gesture now, and selecting every row is something
           * you can do to a uniform list as much as a mixed one -- the tick
           * says what is chosen, and the count beside it says how much of that
           * would actually be written.
           */}
          <button
            type="button"
            className={styles.bulkButton}
            onClick={() => onSetAll(true)}
            disabled={saving}
          >
            Show all {total}
          </button>
          <button
            type="button"
            className={styles.bulkButton}
            onClick={() => onSetAll(false)}
            disabled={saving}
          >
            Hide all {total}
          </button>

          <button type="button" className={styles.bulkButton} onClick={onExit} disabled={saving}>
            {dirtyCount > 0 ? 'Cancel' : 'Done'}
          </button>
          {dirtyCount > 0 && (
            <button type="button" className={styles.saveButton} onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
