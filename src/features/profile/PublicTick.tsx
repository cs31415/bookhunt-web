import styles from './ProfilePage.module.css';

/**
 * The owner's tick, with words for what pressing it would do.
 *
 * The label names the action rather than the state — "Display on public
 * profile" while it is off — because a bare box under a cover says nothing
 * about what it governs.
 *
 * The label wraps the box, so the visible words are the accessible name too.
 * What the tick belongs to comes from its surroundings: BookCard groups each
 * card under the book's title, and an author row carries the author's name.
 */
export function PublicTick({
  shown,
  onChange,
}: {
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
      <span className={styles.tickText}>
        {shown ? 'Hide from public profile' : 'Display on public profile'}
      </span>
    </label>
  );
}
