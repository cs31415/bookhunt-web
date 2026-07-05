import type { BookSummary } from '../../types/book';
import type { LibraryStatus } from '../../types/library-status';
import { Cover } from '../Cover/Cover';
import { Stars } from '../Stars/Stars';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import styles from './BookRow.module.css';

export interface BookRowProps {
  book: BookSummary;
  status?: LibraryStatus;
  reason?: string;
  onClick?: () => void;
}

export function BookRow({ book, status, reason, onClick }: BookRowProps) {
  return (
    <button type="button" className={styles.row} onClick={onClick}>
      <Cover book={book} width={52} />
      <div className={styles.info}>
        {reason && <div className={styles.eyebrow}>{reason}</div>}
        <div className={styles.title}>{book.title}</div>
        <div className={styles.author}>{book.authorName}</div>
        <div className={styles.statusOrRating}>
          {status ? (
            <StatusBadge status={status} />
          ) : book.rating != null ? (
            <Stars value={book.rating} mode="display" />
          ) : null}
        </div>
      </div>
    </button>
  );
}
