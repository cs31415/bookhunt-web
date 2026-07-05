import type { BookSummary } from '../../types/book';
import type { LibraryStatus } from '../../types/library-status';
import { Cover } from '../Cover/Cover';
import { Stars } from '../Stars/Stars';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import styles from './BookCard.module.css';

export interface BookCardProps {
  book: BookSummary;
  status?: LibraryStatus;
  onClick?: () => void;
}

export function BookCard({ book, status, onClick }: BookCardProps) {
  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <div className={styles.coverWrap}>
        <Cover book={book} size="md" />
        {status && (
          <div className={styles.badgeOverlay}>
            <StatusBadge status={status} />
          </div>
        )}
      </div>
      <div className={styles.title}>{book.title}</div>
      <div className={styles.author}>{book.authorName}</div>
      <div className={styles.rating}>
        {book.rating != null ? (
          <Stars value={book.rating} mode="display" />
        ) : book.source === 'google_books' ? (
          <span className={styles.label}>GOOGLE BOOKS</span>
        ) : (
          <span className={styles.label}>Unrated</span>
        )}
      </div>
    </button>
  );
}
