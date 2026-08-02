import styles from './FilterGroup.module.css';

export interface FilterGroupItem {
  value: string;
  label: string;
}

export interface FilterGroupProps {
  title: string;
  items: FilterGroupItem[];
  activeValue: string | null;
  onSelect: (value: string) => void;
}

/**
 * A titled row of pills with at most one selected. Shared by the search rail
 * and the library rail so the two pages filter the same way.
 *
 * Renders nothing when there is nothing to offer — a heading over an empty row
 * reads as a fault rather than as an absence, and both pages have facets that
 * legitimately have no values yet.
 */
export function FilterGroup({ title, items, activeValue, onSelect }: FilterGroupProps) {
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
            aria-pressed={item.value === activeValue}
            onClick={() => onSelect(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
