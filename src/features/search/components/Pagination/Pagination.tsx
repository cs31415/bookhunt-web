import { pageList } from './page-list';
import styles from './Pagination.module.css';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  function goTo(target: number) {
    onPageChange(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.navButton}
        disabled={page === 1}
        onClick={() => goTo(page - 1)}
      >
        ‹ Prev
      </button>
      {pageList(page, totalPages).map((item, i) =>
        item === '…' ? (
          <span key={`ellipsis-${i}`} className={styles.ellipsis}>
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={item === page ? `${styles.pill} ${styles.active}` : styles.pill}
            onClick={() => goTo(item)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={styles.navButton}
        disabled={page === totalPages}
        onClick={() => goTo(page + 1)}
      >
        Next ›
      </button>
    </div>
  );
}
