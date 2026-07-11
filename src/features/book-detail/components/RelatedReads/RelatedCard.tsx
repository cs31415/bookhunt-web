import { Cover } from '../../../../shared/components/Cover/Cover';
import { Stars } from '../../../../shared/components/Stars/Stars';
import { StatusBadge } from '../../../../shared/components/StatusBadge/StatusBadge';
import type { BookSummary } from '../../../../shared/types/book';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import styles from './RelatedCard.module.css';

export interface RelatedCardProps {
  book: BookSummary;
  source: 'you' | 'auto';
  inLibrary: boolean;
  status?: LibraryStatus;
  onOpen: () => void;
  onRemove?: () => void;
  onToggleLibrary: () => void;
}

export function RelatedCard({ book, source, inLibrary, status, onOpen, onRemove, onToggleLibrary }: RelatedCardProps) {
  return (
    <div className={styles.card}>
      <div
        className={inLibrary ? `${styles.coverWrap} ${styles.inLibrary}` : styles.coverWrap}
        onClick={onOpen}
      >
        <div className={inLibrary ? styles.coverInner : `${styles.coverInner} ${styles.dimmed}`}>
          <Cover book={book} width="100%" />
        </div>
        {source === 'you' && onRemove && (
          <button
            type="button"
            title="Remove from related"
            className={styles.removeButton}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        )}
        <button
          type="button"
          title={inLibrary ? 'Remove from library' : 'Add to library'}
          className={inLibrary ? styles.libButton : `${styles.libButton} ${styles.libButtonAdd}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLibrary();
          }}
        >
          {inLibrary ? '–' : '+'}
        </button>
      </div>
      <div>
        <div className={source === 'you' ? `${styles.eyebrow} ${styles.eyebrowYou}` : styles.eyebrow}>
          {source === 'you' ? 'Added by you' : 'Suggested'}
        </div>
        <button
          type="button"
          className={inLibrary ? styles.title : `${styles.title} ${styles.dimmed}`}
          onClick={onOpen}
        >
          {book.title}
        </button>
        <div className={styles.author}>{book.authorName}</div>
        {inLibrary && status ? (
          <StatusBadge status={status} />
        ) : book.rating != null ? (
          <div className={styles.ratingRow}>
            <Stars value={book.rating} mode="display" />
            <span className={styles.ratingValue}>{book.rating.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
