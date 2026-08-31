import styles from './ProfilePage.module.css';

/**
 * The owner's tick: whether this row appears on the public page.
 *
 * One fixed word, and the box carries the meaning -- checked is shown, unchecked
 * is hidden. That is the ordinary reading of a checkbox, and it is what the
 * label had stopped doing (LOS-358): it used to name the *action*, so a ticked
 * box read "Hide from public profile" and said the opposite of what the tick
 * meant. A label that changes as you work is one more thing to track.
 *
 * So a wholly public library opens with every box ticked, and that is now simply
 * true rather than the alarming thing it was when the words disagreed.
 *
 * The label wraps the box, so the visible word is the accessible name too. One
 * word is enough because what the tick belongs to comes from its surroundings:
 * BookCard groups each card under the book's title, and an author row carries
 * the author's name.
 */
export function PublicTick({
  shown,
  onChange,
}: {
  /** Whether the row is on the public page, with any staged change applied. */
  shown: boolean;
  onChange: (shown: boolean) => void;
}) {
  return (
    <label className={styles.tick}>
      <input
        type="checkbox"
        className={styles.showBox}
        checked={shown}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.tickText}>Show</span>
    </label>
  );
}
