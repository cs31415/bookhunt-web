import { FilterGroup } from '../../../../shared/components/FilterGroup/FilterGroup';
import type { ShelfFacets } from '../../../../api/users/get-public-library';
import styles from './ProfileFacets.module.css';

export interface ProfileFacetsProps {
  /** What this shelf can be narrowed by, over the whole shelf. */
  facets: ShelfFacets;
  subject: string;
  mood: string;
  theme: string;
  onSelectSubject: (value: string) => void;
  onSelectMood: (value: string) => void;
  onSelectTheme: (value: string) => void;
  onClearFilters: () => void;
}

function toItems(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

/**
 * The facets a profile shelf offers, in the same pills the library and search
 * rails use.
 *
 * Status is deliberately absent, though the API returns it. The tabs above the
 * shelf already are the status filter -- Library, Currently reading,
 * Favourites -- and a second control doing the same job invites the two to
 * disagree about what is selected.
 *
 * Each group disappears when its facet has nothing to offer: FilterGroup
 * renders nothing for an empty list, so a shelf whose books carry no moods
 * shows no Mood heading rather than an empty one.
 */
export function ProfileFacets({
  facets,
  subject,
  mood,
  theme,
  onSelectSubject,
  onSelectMood,
  onSelectTheme,
  onClearFilters,
}: ProfileFacetsProps) {
  const anyActive = Boolean(subject || mood || theme);

  return (
    <div className={styles.groups}>
      <FilterGroup
        title="Category"
        items={toItems(facets.subject)}
        activeValue={subject || null}
        onSelect={onSelectSubject}
      />
      <FilterGroup
        title="Mood"
        items={toItems(facets.mood)}
        activeValue={mood || null}
        onSelect={onSelectMood}
      />
      <FilterGroup
        title="Theme"
        items={toItems(facets.theme)}
        activeValue={theme || null}
        onSelect={onSelectTheme}
      />

      {/* Only once something is set: a Clear that never does anything is
          furniture, and the library rail hides its own for the same reason. */}
      {anyActive && (
        <button type="button" className={styles.clearButton} onClick={onClearFilters}>
          Clear filters
        </button>
      )}
    </div>
  );
}
