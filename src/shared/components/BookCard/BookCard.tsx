import type { BookSummary } from '../../types/book';
import type { LibraryStatus } from '../../types/library-status';
import { Cover } from '../Cover/Cover';
import { Stars } from '../Stars/Stars';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import styles from './BookCard.module.css';

export interface BookCardProps {
  book: BookSummary;
  status?: LibraryStatus;
  reason?: string;
  onClick?: () => void;
}

export function BookCard({ book, status, reason, onClick }: BookCardProps) {
  return (
    <button type="button" className={`${styles.card} fade-up`} onClick={onClick}>
      <div className={styles.coverWrap}>
        <Cover book={book} width="100%" />
        {status && (
          <div className={styles.badgeOverlay}>
            <StatusBadge status={status} />
          </div>
        )}
      </div>
      <div>
        {reason && <div className={styles.eyebrow}>{reason}</div>}
        <div className={styles.title}>{book.title}</div>
        <div className={styles.meta}>
          {book.authorName}
          {book.year ? ` · ${book.year}` : ''}
        </div>
        <div className={styles.rating}>
          {book.rating != null ? (
            <>
              <Stars value={book.rating} mode="display" />
              <span className={styles.ratingValue}>{book.rating.toFixed(1)}</span>
            </>
          ) : (
            <span className={styles.label}>
              {book.source === 'google_books'
                ? 'GOOGLE BOOKS'
                : book.source === 'open_library'
                  ? 'OPEN LIBRARY'
                  : 'Unrated'}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
