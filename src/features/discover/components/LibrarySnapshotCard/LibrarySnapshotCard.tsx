import { PieChart } from '../../../../shared/components/PieChart/PieChart';
import {
  ALL_LIBRARY_STATUSES,
  LIBRARY_STATUS_LABELS,
} from '../../../../shared/types/library-status';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import styles from './LibrarySnapshotCard.module.css';

const STATUS_COLORS: Record<LibraryStatus, string> = {
  queued: 'var(--slate)',
  reading: 'var(--rust)',
  finished: 'var(--sage)',
  abandoned: 'var(--muted)',
};

const STATUS_BY_LABEL = new Map<string, LibraryStatus>(
  ALL_LIBRARY_STATUSES.map((status) => [LIBRARY_STATUS_LABELS[status], status]),
);

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
  if (total === 0) {
    return (
      <section className={styles.card}>
        <h2 className={styles.emptyTitle}>Start your library</h2>
        <div className={styles.placeholder}>
          <div className={styles.placeholderRing} />
          <p className={styles.placeholderText}>Your reading breakdown appears here</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={onAddFirstBook}>
          Add your first book
        </button>
      </section>
    );
  }

  const slices = ALL_LIBRARY_STATUSES.filter((status) => counts[status] > 0).map((status) => ({
    label: LIBRARY_STATUS_LABELS[status],
    value: counts[status],
    color: STATUS_COLORS[status],
  }));

  function handlePick(label: string) {
    const status = STATUS_BY_LABEL.get(label);
    if (status) onSliceClick(status);
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Library snapshot</div>
          <div className={styles.total}>
            {total} {total === 1 ? 'book' : 'books'}
          </div>
        </div>
        <button type="button" className={styles.openLibrary} onClick={onOpenLibrary}>
          Open library
        </button>
      </div>
      <PieChart slices={slices} onPick={(slice) => handlePick(slice.label)} />
    </section>
  );
}
