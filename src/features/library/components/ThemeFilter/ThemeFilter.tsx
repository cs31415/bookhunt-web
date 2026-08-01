import { topThemes } from '../../lib/breakdowns';
import type { LibraryEntry } from '../../../../normalize/library';
import styles from './ThemeFilter.module.css';

/** Enough to be useful without turning into a wall of phrases. */
const MAX_THEMES = 12;

export interface ThemeFilterProps {
  entries: LibraryEntry[];
  active: string | null;
  onSelect: (theme: string) => void;
}

/**
 * Themes as chips rather than a pie: they are long free-text phrases and
 * near-unique across a library, so a chart of them would be slivers and an
 * "Other" bucket. A chip carries the whole phrase and is still one click to
 * filter — see topThemes.
 */
export function ThemeFilter({ entries, active, onSelect }: ThemeFilterProps) {
  const themes = topThemes(entries, MAX_THEMES);
  // Themes are AI-generated and filled in lazily, so a library where nothing
  // has been tagged yet shows nothing rather than an empty heading.
  if (themes.length === 0) return null;

  return (
    <section className={styles.wrap} aria-label="Filter by theme">
      <div className={styles.title}>By Theme</div>
      <div className={styles.chips}>
        {themes.map((theme) => (
          <button
            key={theme}
            type="button"
            className={theme === active ? `${styles.chip} ${styles.active}` : styles.chip}
            aria-pressed={theme === active}
            onClick={() => onSelect(theme)}
          >
            {theme}
          </button>
        ))}
      </div>
    </section>
  );
}
