import type { ReactNode } from 'react';
import type { BookSummary } from '../../types/book';
import type { LibraryStatus } from '../../types/library-status';
import { Cover } from '../Cover/Cover';
import { Stars } from '../Stars/Stars';
import { CoverFold } from '../CoverFold/CoverFold';
import styles from './BookCard.module.css';

export interface BookCardProps {
  book: BookSummary;
  status?: LibraryStatus;
  reason?: string;
  onClick?: () => void;
  /**
   * A control shown at the right of the title line — a menu trigger, a
   * checkbox. Rendered as a sibling of the card button rather than inside it,
   * because a button nested in a button is invalid HTML and browsers disagree
   * about what to do with the click. Callers that pass nothing render exactly
   * as before, one wrapper element aside.
   */
  action?: ReactNode;
  /**
   * A control laid over the cover — the favourite heart (LOS-252). Separate
   * from `action` because it belongs to the artwork rather than the title line,
   * and because a card can carry both: the library grid shows a heart and a
   * menu at once. Outside the card button for the same reason `action` is.
   */
  overlay?: ReactNode;
}

export function BookCard({ book, status, reason, onClick, action, overlay }: BookCardProps) {
  return (
    // Grouped and named after the book only when there is an action, so the
    // control beside the card has context to inherit: it can then be labelled
    // for what it does ("Book actions") without every card in the grid
    // repeating the title to say which book it acts on.
    <div
      className={`${styles.wrap} fade-up`}
      {...((action || overlay) && { role: 'group', 'aria-label': book.title })}
    >
      <button type="button" className={styles.card} onClick={onClick}>
        <div className={styles.coverWrap}>
          <Cover book={book} width="100%" />
          {status && <CoverFold status={status} />}
        </div>
        <div>
          {reason && <div className={styles.eyebrow}>{reason}</div>}
          <div className={styles.title}>{book.title}</div>
          <div className={styles.meta}>
            {book.authorName}
            {book.year ? ` · ${book.year}` : ''}
          </div>
          <div className={styles.rating}>
            <Stars value={book.rating ?? 0} mode="display" />
            {book.rating != null && <span className={styles.ratingValue}>{book.rating.toFixed(1)}</span>}
          </div>
        </div>
      </button>
      {/* A sibling of the card button, laid over the cover by CSS: nesting it
          would put a button inside a button, which browsers disagree about. */}
      {overlay && <div className={styles.overlay}>{overlay}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
