import { LIBRARY_STATUS_LABELS } from '../../../../shared/types/library-status';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import styles from './StatusTabs.module.css';

// Display order per LOS-81 AC1 (differs from storage order).
const TAB_ORDER: LibraryStatus[] = ['finished', 'reading', 'queued', 'abandoned'];

export interface StatusTabsProps {
  counts: Record<LibraryStatus, number>;
  total: number;
  active: LibraryStatus | null;
  onSelect: (status: LibraryStatus | null) => void;
}

export function StatusTabs({ counts, total, active, onSelect }: StatusTabsProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Filter by status">
      <button
        type="button"
        role="tab"
        aria-selected={active === null}
        className={`${styles.tab} ${active === null ? styles.active : ''}`}
        onClick={() => onSelect(null)}
      >
        All <span className={styles.count}>{total}</span>
      </button>
      {TAB_ORDER.filter((status) => counts[status] > 0).map((status) => (
        <button
          key={status}
          type="button"
          role="tab"
          aria-selected={active === status}
          className={`${styles.tab} ${active === status ? styles.active : ''}`}
          onClick={() => onSelect(status)}
        >
          {LIBRARY_STATUS_LABELS[status]} <span className={styles.count}>{counts[status]}</span>
        </button>
      ))}
    </div>
  );
}
