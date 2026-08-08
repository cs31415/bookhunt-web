import styles from './Loader.module.css';

/**
 * Every page runs the same right-to-left sweep; the CSS offsets them in time,
 * and that stagger is what spreads them into a fan.
 */
const PAGE_COUNT = 5;

export function Loader() {
  return (
    <div className={styles.loader} role="status" aria-label="Loading">
      <svg className={styles.book} viewBox="0 0 64 30" aria-hidden="true">
        {/* The open book that stays put: the two settled pages, and the gutter
            binding them. A flipping page at either end of its sweep lands
            exactly on one of these, which is what hides the loop's seam. */}
        <g>
          <path d="M7 22h21" />
          <path d="M36 22h21" />
          <path d="M28 22v2.5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V22" />
        </g>
        <g className={styles.pages}>
          {Array.from({ length: PAGE_COUNT }, (_, i) => (
            <path key={i} d="M36 22h21" />
          ))}
        </g>
      </svg>
    </div>
  );
}
