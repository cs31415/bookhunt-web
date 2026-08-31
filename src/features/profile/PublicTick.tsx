import styles from './ProfilePage.module.css';

/**
 * The owner's tick: a pending change, not a state (LOS-358).
 *
 * Ticked means "this one is selected to change", and the label names the change
 * that would be made. Edit opens with nothing ticked, so each row offers the one
 * action available to it -- a public book offers Hide, a hidden one Show. Once a
 * row is selected the label follows the selection instead, which is what lets
 * Hide all read "Hide" on every row including the ones already hidden.
 *
 * It used to be the state, ticked when the book was public. That put a screen of
 * ticks in front of a reader who had done nothing, each labelled with the
 * opposite of what the tick meant, and it disagreed with the model underneath:
 * `staged` has always been a map of pending changes, and this now shows it.
 *
 * The label wraps the box, so the visible words are the accessible name too.
 * What the tick belongs to comes from its surroundings: BookCard groups each
 * card under the book's title, and an author row carries the author's name.
 */
export function PublicTick({
  hidden,
  stagedHidden,
  onToggle,
}: {
  /** Whether the row is hidden as the server has it, before any staging. */
  hidden: boolean;
  /** What it is selected to become, or undefined when it is not selected. */
  stagedHidden?: boolean;
  /** Selects this row, or cancels the selection. */
  onToggle: (selected: boolean) => void;
}) {
  const selected = stagedHidden !== undefined;
  // Selected rows describe their selection; unselected ones offer the opposite
  // of where they rest, which is the only thing a press could do to them.
  const willHide = stagedHidden ?? !hidden;

  return (
    <label className={styles.tick}>
      <input
        type="checkbox"
        className={styles.showBox}
        checked={selected}
        onChange={(event) => onToggle(event.target.checked)}
      />
      <span className={styles.tickText}>{willHide ? 'Hide' : 'Show'}</span>
    </label>
  );
}
