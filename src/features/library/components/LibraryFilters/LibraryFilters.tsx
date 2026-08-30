import { FilterGroup } from '../../../../shared/components/FilterGroup/FilterGroup';
import { ALL_LIBRARY_STATUSES, LIBRARY_STATUS_LABELS } from '../../../../shared/types/library-status';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import type { LibraryEntry } from '../../../../normalize/library';
import { topCategories, topMoods, topThemes, statusCounts, formatCounts } from '../../lib/breakdowns';
import type { LibraryFormat } from '../../lib/breakdowns';
import styles from './LibraryFilters.module.css';

export interface LibraryFiltersProps {
  entries: LibraryEntry[];
  status: LibraryStatus | null;
  category: string | null;
  mood: string | null;
  theme: string | null;
  favorite: boolean;
  format: LibraryFormat | null;
  onToggleFavorite: () => void;
  onSelectFormat: (format: LibraryFormat) => void;
  onSelectStatus: (status: LibraryStatus) => void;
  onSelectCategory: (category: string) => void;
  onSelectMood: (mood: string) => void;
  onSelectTheme: (theme: string) => void;
  onClearFilters: () => void;
}

function toItems(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

/** Reading order, and the only place these are spelled for a reader. */
const FORMAT_LABELS: { value: LibraryFormat; label: string }[] = [
  { value: 'ebook', label: 'Ebook' },
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'physical', label: 'Physical' },
];

/**
 * The library's filter rail, matching the search page's so the two read the
 * same way.
 *
 * This replaced pie charts, which could not work here: the facets are long-
 * tailed, so the top 7 slices covered 8% of the subject chart and 11% of the
 * author chart and the rest went into an "Other" wedge that was 89-92% of the
 * ink and was not even clickable. Pills show only what is worth clicking and
 * simply stop.
 *
 * No author group. 273 authors across 331 books, 242 of them with a single
 * book, so it would be a list of dead ends — and the search box above already
 * finds books by author, which is what it was really being used for.
 */
export function LibraryFilters({
  entries,
  status,
  category,
  mood,
  theme,
  favorite,
  format,
  onToggleFavorite,
  onSelectFormat,
  onSelectStatus,
  onSelectCategory,
  onSelectMood,
  onSelectTheme,
  onClearFilters,
}: LibraryFiltersProps) {
  const counts = statusCounts(entries);
  const favoriteCount = entries.filter((entry) => entry.isFavorite).length;
  const formats = formatCounts(entries);
  const formatPills = FORMAT_LABELS.filter(({ value }) => formats[value] > 0).map(
    ({ value, label }) => ({ value, label: `${label} ${formats[value]}` }),
  );
  const hasActiveFilters = Boolean(status || category || mood || theme || favorite || format);

  return (
    <div className={styles.groups}>
      {/* First, and its own single-pill group: it narrows alongside a shelf
          rather than competing with one, and a reader looking for favourites
          should not have to scroll past four facets to find them. Hidden
          entirely when nothing is favourited, like the facet groups below. */}
      {favoriteCount > 0 && (
        <FilterGroup
          title="Favourites"
          items={[{ value: 'favorite', label: `Favourites (${favoriteCount})` }]}
          activeValue={favorite ? 'favorite' : null}
          onSelect={onToggleFavorite}
        />
      )}
      {/* Only formats the shelf actually holds, and only when more than one
          does: a lone pill over an all-paperback library can filter to nothing
          but what it already shows. */}
      {formatPills.length > 1 && (
        <FilterGroup
          title="Format"
          items={formatPills}
          activeValue={format}
          onSelect={(value) => onSelectFormat(value as LibraryFormat)}
        />
      )}
      <FilterGroup
        title="Category"
        items={toItems(topCategories(entries))}
        activeValue={category}
        onSelect={onSelectCategory}
      />
      <FilterGroup title="Mood" items={toItems(topMoods(entries))} activeValue={mood} onSelect={onSelectMood} />
      <FilterGroup title="Theme" items={toItems(topThemes(entries))} activeValue={theme} onSelect={onSelectTheme} />
      <FilterGroup
        title="Status"
        // Statuses with no books are left out, as the status tabs this replaced
        // did: a shelf you have never used is a pill that can only ever empty
        // the grid. Counts ride along because they are the one number worth
        // knowing before you click.
        items={ALL_LIBRARY_STATUSES.filter((value) => counts[value] > 0).map((value) => ({
          value,
          label: `${LIBRARY_STATUS_LABELS[value]} ${counts[value]}`,
        }))}
        activeValue={status}
        onSelect={(value) => onSelectStatus(value as LibraryStatus)}
      />

      {hasActiveFilters && (
        <button type="button" className={styles.clearButton} onClick={onClearFilters}>
          Clear filters
        </button>
      )}
    </div>
  );
}
