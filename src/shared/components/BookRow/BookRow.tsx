import type { BookSummary } from '../../types/book';
import type { LibraryStatus } from '../../types/library-status';
import { Cover } from '../Cover/Cover';
import { Stars } from '../Stars/Stars';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import styles from './BookRow.module.css';

export interface BookRowProps {
  book: BookSummary;
  status?: LibraryStatus;
  onClick?: () => void;
}

export function BookRow({ book, status, onClick }: BookRowProps) {
  return (
    <button type="button" className={styles.row} onClick={onClick}>
      <Cover book={book} size="sm" />
      <div className={styles.info}>
        <div className={styles.title}>{book.title}</div>
        <div className={styles.author}>{book.authorName}</div>
        {book.rating != null ? (
          <Stars value={book.rating} mode="display" />
        ) : book.source === 'google_books' ? (
          <span className={styles.label}>GOOGLE BOOKS</span>
        ) : (
          <span className={styles.label}>Unrated</span>
        )}
      </div>
      {status && <StatusBadge status={status} />}
    </button>
  );
}
