import { BookCard } from '../../../../shared/components/BookCard/BookCard';
import type { SearchResultItem } from '../../../../normalize/search';
import styles from './ResultsGrid.module.css';

export interface ResultsGridProps {
  results: SearchResultItem[];
  loading: boolean;
  onSelectBook: (slug: string) => void;
}

export function ResultsGrid({ results, loading, onSelectBook }: ResultsGridProps) {
  if (loading) {
    return (
      <div className={styles.grid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={styles.skeletonCard}>
            <div className={styles.skeletonCover} />
            <div className={styles.skeletonLine} style={{ width: '85%' }} />
            <div className={styles.skeletonLine} style={{ width: '55%' }} />
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No books match.</div>
        <p className={styles.emptyHint}>Try a broader query or clear some filters.</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {results.map(({ book, status }) => (
        <BookCard key={book.id} book={book} status={status} onClick={() => onSelectBook(book.slug)} />
      ))}
    </div>
  );
}
