import { Cover } from '../../../../shared/components/Cover/Cover';
import { LIBRARY_STATUS_COLORS, LIBRARY_STATUS_LABELS } from '../../../../shared/types/library-status';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import type { DetectedBook } from '../../../../normalize/detected-book';
import styles from './ScanModal.module.css';

export interface DetectedBookRowProps {
  detected: DetectedBook;
  status: LibraryStatus;
  ticked: boolean;
  onCycleStatus: () => void;
  onToggle: () => void;
}

export function DetectedBookRow({
  detected,
  status,
  ticked,
  onCycleStatus,
  onToggle,
}: DetectedBookRowProps) {
  const { book, tier } = detected;

  return (
    <div className={ticked ? styles.row : `${styles.row} ${styles.rowOff}`}>
      <Cover book={book} width={40} />

      <div className={styles.rowText}>
        <div className={styles.rowTitle}>{book.title}</div>
        <div className={styles.rowAuthor}>{book.authorName}</div>
        {tier === 'unresolved' && (
          <div className={styles.rowNote}>Couldn’t match this one — add it anyway?</div>
        )}
      </div>

      {ticked && (
        <button
          type="button"
          className={styles.statusPill}
          style={{ borderColor: LIBRARY_STATUS_COLORS[status], color: LIBRARY_STATUS_COLORS[status] }}
          onClick={onCycleStatus}
        >
          <span className={styles.statusDot} style={{ background: LIBRARY_STATUS_COLORS[status] }} />
          {LIBRARY_STATUS_LABELS[status]}
        </button>
      )}

      <button
        type="button"
        className={styles.tick}
        role="checkbox"
        aria-checked={ticked}
        aria-label={`${ticked ? 'Skip' : 'Include'} ${book.title}`}
        onClick={onToggle}
      >
        {ticked ? '✓' : '+'}
      </button>
    </div>
  );
}
