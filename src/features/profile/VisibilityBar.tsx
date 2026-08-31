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
           * Each goes quiet only when it provably cannot write anything: Show
           * all on a list that is entirely shown, Hide all on one entirely
           * hidden. A button that could do nothing at all should say so.
           *
           * That is a narrower rule than it looks, and it does not contradict
           * what a press does (LOS-358). On a mixed list both stay live, and
           * pressing one still ticks every row -- including the ones already in
           * that state, which contribute nothing to the count beside it. The
           * disabling is about the whole list having nothing to write; the
           * ticking is about what you selected.
           */}
          <button
            type="button"
            className={styles.bulkButton}
            onClick={() => onSetAll(true)}
            disabled={saving || publicCount === total}
          >
            Show all {total}
          </button>
          <button
            type="button"
            className={styles.bulkButton}
            onClick={() => onSetAll(false)}
            disabled={saving || publicCount === 0}
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
