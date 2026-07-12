import { ALL_LIBRARY_STATUSES, LIBRARY_STATUS_LABELS } from '../../../../shared/types/library-status';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import type { ParsedSearchParams } from '../../search-params';
import styles from './FilterSidebar.module.css';

export interface FilterSidebarProps {
  parsed: ParsedSearchParams;
  onToggleInLibraryOnly: () => void;
  onSelectStatus: (status: LibraryStatus) => void;
  onClearFilters: () => void;
}

function FilterGroup({
  title,
  items,
  activeValue,
  onSelect,
}: {
  title: string;
  items: { value: string; label: string }[];
  activeValue: string | null;
  onSelect: (value: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className={styles.group}>
      <div className={styles.groupTitle}>{title}</div>
      <div className={styles.pillRow}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            className={item.value === activeValue ? `${styles.pill} ${styles.active}` : styles.pill}
            onClick={() => onSelect(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterSidebar({
  parsed,
  onToggleInLibraryOnly,
  onSelectStatus,
  onClearFilters,
}: FilterSidebarProps) {
  const hasActiveFilters = parsed.inLibraryOnly || Boolean(parsed.status);

  return (
    <aside className={styles.rail}>
      <label className={styles.toggleRow} onClick={onToggleInLibraryOnly}>
        <span className={parsed.inLibraryOnly ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle}>
          <span className={styles.toggleKnob} />
        </span>
        <span>In my library only</span>
      </label>

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
    </aside>
  );
}
