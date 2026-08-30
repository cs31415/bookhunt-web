import { ALL_LIBRARY_STATUSES, LIBRARY_STATUS_LABELS } from '../../../../shared/types/library-status';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import { FilterGroup } from '../../../../shared/components/FilterGroup/FilterGroup';
import type { ParsedSearchParams } from '../../search-params';
import styles from './FilterSidebar.module.css';

export interface FilterSidebarProps {
  parsed: ParsedSearchParams;
  availableCategories: string[];
  availableMoods: string[];
  /** False when signed out — there's no library to filter against. */
  canFilterByLibrary: boolean;
  onToggleInLibraryOnly: () => void;
  onSelectCategory: (category: string) => void;
  onSelectMood: (mood: string) => void;
  onSelectStatus: (status: LibraryStatus) => void;
  onClearFilters: () => void;
}

export function FilterSidebar({
  parsed,
  availableCategories,
  availableMoods,
  canFilterByLibrary,
  onToggleInLibraryOnly,
  onSelectCategory,
  onSelectMood,
  onSelectStatus,
  onClearFilters,
}: FilterSidebarProps) {
  const hasActiveFilters =
    parsed.inLibraryOnly || Boolean(parsed.status) || Boolean(parsed.subject) || Boolean(parsed.mood);

  return (
    <div className={styles.groups}>
      {/* A real switch rather than a click-handling label: `disabled` then blocks
          both pointer and keyboard activation, and screen readers announce the
          on/off state and why it's unavailable. */}
      <button
        type="button"
        role="switch"
        aria-checked={parsed.inLibraryOnly}
        disabled={!canFilterByLibrary}
        title={canFilterByLibrary ? undefined : 'Sign in to filter by your library'}
        className={styles.toggleRow}
        onClick={onToggleInLibraryOnly}
      >
        <span className={parsed.inLibraryOnly ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle}>
          <span className={styles.toggleKnob} />
        </span>
        <span>In my library only</span>
      </button>

      <FilterGroup
        title="Category"
        items={availableCategories.map((c) => ({ value: c, label: c }))}
        activeValue={parsed.subject}
        onSelect={onSelectCategory}
      />
      <FilterGroup
        title="Mood"
        items={availableMoods.map((m) => ({ value: m, label: m }))}
        activeValue={parsed.mood}
        onSelect={onSelectMood}
      />
      <FilterGroup
        title="Status"
        items={ALL_LIBRARY_STATUSES.map((s) => ({ value: s, label: LIBRARY_STATUS_LABELS[s] }))}
        activeValue={parsed.status}
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
