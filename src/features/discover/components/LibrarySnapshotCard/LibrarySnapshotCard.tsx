import { PieChart } from '../../../../shared/components/PieChart/PieChart';
import {
  ALL_LIBRARY_STATUSES,
  LIBRARY_STATUS_COLORS,
  LIBRARY_STATUS_LABELS,
} from '../../../../shared/types/library-status';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import styles from './LibrarySnapshotCard.module.css';

const STATUS_BY_LABEL = new Map<string, LibraryStatus>(
  ALL_LIBRARY_STATUSES.map((status) => [LIBRARY_STATUS_LABELS[status], status]),
);

const PIE_SIZE = 172;

export interface LibrarySnapshotCardProps {
  total: number;
  counts: Record<LibraryStatus, number>;
  onSliceClick: (status: LibraryStatus) => void;
  onOpenLibrary: () => void;
  onAddFirstBook: () => void;
}

export function LibrarySnapshotCard({
  total,
  counts,
  onSliceClick,
  onOpenLibrary,
  onAddFirstBook,
}: LibrarySnapshotCardProps) {
  const slices = ALL_LIBRARY_STATUSES.filter((status) => counts[status] > 0).map((status) => ({
    label: LIBRARY_STATUS_LABELS[status],
    value: counts[status],
    color: LIBRARY_STATUS_COLORS[status],
  }));

  function handlePick(label: string) {
    const status = STATUS_BY_LABEL.get(label);
    if (status) onSliceClick(status);
  }

  return (
    <section className={styles.card}>
      <div className={styles.info}>
        <div className={styles.eyebrow}>Your library</div>
        <h2 className={styles.title}>
          {total > 0 ? `${total} ${total === 1 ? 'book' : 'books'}, and counting` : 'Start your library'}
        </h2>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={total > 0 ? onOpenLibrary : onAddFirstBook}
        >
          {total > 0 ? 'Open library' : 'Add your first book'}
        </button>
      </div>
      <div className={styles.visual}>
        {slices.length > 0 ? (
          <PieChart slices={slices} size={PIE_SIZE} onPick={(slice) => handlePick(slice.label)} />
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderText}>Your reading breakdown appears here</span>
          </div>
        )}
      </div>
    </section>
  );
}
