import styles from './TabBar.module.css';

export interface Tab<Id extends string> {
  id: Id;
  label: string;
}

export interface TabBarProps<Id extends string> {
  tabs: Tab<Id>[];
  active: Id;
  onSelect: (id: Id) => void;
  /** Names the set for a screen reader — "Profile sections", "Favourites". */
  label: string;
  /** A second, quieter row nested under a tab. Same behaviour, lighter type. */
  variant?: 'primary' | 'sub';
}

/**
 * The underlined tab row, lifted out of ProfilePage so the favourites page and
 * the profile can share one implementation rather than two that drift.
 *
 * Generic in the id so each caller keeps its own union — a profile cannot be
 * handed a favourites tab, and neither page has to widen its type to a bare
 * string to use this.
 */
export function TabBar<Id extends string>({
  tabs,
  active,
  onSelect,
  label,
  variant = 'primary',
}: TabBarProps<Id>) {
  return (
    <div
      className={variant === 'sub' ? `${styles.tabs} ${styles.sub}` : styles.tabs}
      role="tablist"
      aria-label={label}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
